// A resilient byte-range "getter" for COPC / LAZ files, in the shape copc.js
// (and therefore Giro3D's COPCSource) expects: `(begin, end) => Uint8Array`
// covering the half-open byte window `[begin, end)`. Ported from lidaroo's
// copcGetter.ts.
//
// Why this exists instead of just passing the URL string to COPCSource:
//
// COPCSource's built-in getter issues a `Range: bytes=<begin>-<end-1>` request
// and then blindly `arrayBuffer()`s whatever comes back, handing it straight to
// the LAS/EVLR parser. That parser reads a fixed-size header (an EVLR header is
// exactly 60 bytes) and throws `Invalid EVLR header length (must be 60): <N>`
// when the slice it receives is not that size.
//
// The RES lidar backend serves the `.copc.laz` through Express, whose file
// mtime rotates on access (the COPC cache touches it) so the weak ETag changes
// every request. Under that condition a `Range` request can intermittently be
// answered with the WHOLE file (HTTP 200, or an open-ended 206) instead of the
// requested slice. copc.js then reads the first bytes of the entire ~31 MB body
// as if they were the 60-byte EVLR header — the byte count in the error message
// is literally the full file length (e.g. 31600907). It is intermittent, so it
// surfaces as an occasional unhandled rejection rather than a hard failure.
//
// This getter reconciles the response to the window that was actually asked
// for, so the parser always sees exactly the bytes it requested:
//   - honored range (correct length)         -> returned as-is;
//   - server ignored Range, sent a superset  -> sliced down to `[begin, end)`
//     (using Content-Range to locate where the returned bytes start in the
//     file, so the slice offset is correct whether the body began at 0 or not);
//   - short / truncated / error body         -> a clean, descriptive throw,
//     which COPCSource.add() rejects with and the scene surfaces as the
//     "could not load" state (no unhandled rejection, no garbage-parse
//     `Invalid EVLR header length`).
//
// Kept dependency-free (plain fetch, no Three.js/Giro3D imports).

// Parses the start offset (in bytes, relative to the start of the file) of the
// data carried by a range response, from its `Content-Range` header
// (`bytes <start>-<end>/<total>`). Returns 0 when the header is absent or
// unparseable — a plain `200 OK` carries the file from offset 0.
function parseContentRangeStart(response) {
    const header = response.headers.get('Content-Range');
    if (!header) {
        return 0;
    }
    const match = /bytes\s+(\d+)-\d+\/(?:\d+|\*)/i.exec(header);
    if (!match) {
        return 0;
    }
    const start = Number.parseInt(match[1], 10);
    return Number.isFinite(start) ? start : 0;
}

// Builds a range getter for `url` that fetches byte ranges over HTTP and
// reconciles the response to the exact window requested (see module docs).
//
// `fetchImpl` is injectable purely so the behavior can be exercised against
// fake responses; it defaults to the global `fetch`.
export function createCopcRangeGetter(url, fetchImpl = fetch) {
    return async (begin, end) => {
        const wanted = end - begin;

        // A zero-length (or nonsensical) window: copc's VLR walker uses an empty
        // read for zero-length records; return an empty buffer rather than a range
        // request the server may answer with the whole file.
        if (wanted <= 0) {
            return new Uint8Array();
        }

        const response = await fetchImpl(url, {
            headers: { Range: `bytes=${begin}-${end - 1}` },
        });

        if (!response.ok) {
            throw new Error(
                `Point cloud request failed (${response.status} ${response.statusText}) for bytes ${begin}-${end - 1}.`,
            );
        }

        const buffer = new Uint8Array(await response.arrayBuffer());

        // Fast path: the server honored the Range and returned exactly the slice.
        if (buffer.byteLength === wanted) {
            return buffer;
        }

        // The server returned MORE than we asked for — it ignored the Range header
        // and sent a superset (typically the entire file: a 200, or an open-ended
        // 206). This is the exact condition behind the intermittent
        // `Invalid EVLR header length (must be 60): <full-file-length>` crash.
        // Recover by slicing out the window we actually wanted. `Content-Range`
        // tells us the file offset the returned bytes start at, so the slice is
        // correct whether the body began at byte 0 (a 200) or elsewhere.
        if (buffer.byteLength > wanted) {
            const returnedStart = parseContentRangeStart(response);
            const sliceStart = begin - returnedStart;
            const sliceEnd = sliceStart + wanted;
            if (sliceStart >= 0 && sliceEnd <= buffer.byteLength) {
                return buffer.subarray(sliceStart, sliceEnd);
            }
            // The returned body does not actually cover the requested window (e.g. a
            // partial superset that starts after `begin`). Treat as unusable.
            throw new Error(
                `Point cloud response did not cover requested bytes ${begin}-${end - 1} ` +
                    `(got ${buffer.byteLength} bytes starting at ${returnedStart}).`,
            );
        }

        // Fewer bytes than requested: a truncated or otherwise corrupt response.
        // Surface it cleanly instead of letting the parser misread a short header.
        throw new Error(
            `Point cloud response was truncated: expected ${wanted} bytes for ` +
                `${begin}-${end - 1}, received ${buffer.byteLength}.`,
        );
    };
}

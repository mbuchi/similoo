import { getFormattedFilename } from '../utils/fileNaming.js';
import { t } from '../i18n.js';

export function setupRecordButton(viewer) {
    const recordButton = document.getElementById('recordButton');
    let mediaRecorder = null;
    let isRecording = false;

    recordButton.addEventListener('click', () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                mediaRecorder = null;
            }
            isRecording = false;
            recordButton.innerHTML = `<span class="record-icon"></span><span>${t('dock.record')}</span>`;
        } else {
            // Start recording
            mediaRecorder = startRecording(viewer, (recorder) => {
                isRecording = true;
                recordButton.innerHTML = `<span class="record-icon recording"></span><span>${t('dock.record_stop')}</span>`;
            });
        }
    });
}

export function startRecording(viewer, onStart) {
    const canvas = viewer.canvas;
    const recordedChunks = [];
    
    // Create a stream from the canvas
    const stream = canvas.captureStream(30); // 30 FPS
    
    // Configure video recording with high compression
    const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality but smaller size
    };
    
    let mediaRecorder;
    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        console.error('MediaRecorder error:', e);
        // Fallback to default options if VP9 is not supported
        mediaRecorder = new MediaRecorder(stream);
    }
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = getFormattedFilename('.webm');
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    };
    
    // Set up data collection interval
    mediaRecorder.start();
    if (onStart) {
        onStart(mediaRecorder);
    }
    
    return mediaRecorder;
}
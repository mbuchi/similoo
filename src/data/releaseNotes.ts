import { Sparkles, Wrench, Bug, FileText, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChangeKind, Release } from '@aireon/shared';
import { canonicalKind } from '@aireon/shared';
// similoo's release history already follows the suite shape
// ({ version, date, codename, summary, items: [{ kind, text, prs }] }); the
// only gap vs the shared <ReleaseNotesPanel> is that its per-item `icon` is a
// vanilla-lucide string name. We derive a lucide-react component from each
// item's kind so the panel renders identically to the rest of the suite.
import { RELEASES as RAW, REPO_URL as RAW_REPO } from '../js/releaseNotes/releaseNotesData.js';

const KIND_ICON: Record<ChangeKind, LucideIcon> = {
  new: Sparkles,
  improved: Wrench,
  fixed: Bug,
  breaking: AlertTriangle,
  docs: FileText,
};

interface RawItem {
  kind: string;
  icon?: string;
  text: string;
  prs?: number[];
}
interface RawRelease {
  version: string;
  date: string;
  codename: string;
  summary: string;
  highlight?: boolean;
  items: RawItem[];
}

export const releases: Release[] = (RAW as RawRelease[]).map((r) => ({
  ...r,
  items: r.items.map((it) => {
    // canonicalKind aliases legacy kinds and returns null for unknowns; fall
    // back to 'improved' so every item resolves to a valid ChangeKind + icon.
    const kind: ChangeKind = canonicalKind(it.kind) ?? 'improved';
    return { kind, icon: KIND_ICON[kind] ?? Sparkles, text: it.text, prs: it.prs };
  }),
}));

export const REPO_URL: string = RAW_REPO;
export const CURRENT_VERSION: string = releases[0]?.version ?? '0.0.0';

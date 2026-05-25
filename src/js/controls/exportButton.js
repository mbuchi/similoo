import { getFormattedFilename } from '../utils/fileNaming.js';

// Local PNG download. Kept alongside the new "Save to library" feature
// (Camera icon + Gallery icon in the navbar) so users still have an
// offline export path.
export function setupExportButton(viewer) {
    const exportButton = document.getElementById('exportButton');
    if (!exportButton) return;

    exportButton.addEventListener('click', () => {
        const filename = getFormattedFilename('.png');

        try {
            viewer.render();
            const screenshot = viewer.scene.canvas.toDataURL('image/png');

            const link = document.createElement('a');
            link.href = screenshot;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error capturing screenshot:', error);
        }
    });
}

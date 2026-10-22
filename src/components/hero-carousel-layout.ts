export function getHeroCardWidth(viewportWidth: number, slideCount: number): number {
    const previewWidth = viewportWidth < 600 && slideCount > 1 ? 28 : 0;
    return Math.max(1, viewportWidth - previewWidth);
}

import Phaser from 'phaser';

// Covers the whole scene with a background image
export const coverSceneBackground = (
    image: Phaser.GameObjects.Image,
    width: number,
    height: number
) => {
    coverImageArea(image, width, height, width / 2, height / 2);
};

// Covers a custom area with an image
const coverImageArea = (
    image: Phaser.GameObjects.Image,
    width: number,
    height: number,
    x: number,
    y: number
) => {
    const sourceWidth = image.width || 1;
    const sourceHeight = image.height || 1;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);

    image.setOrigin(0.5);
    image.setPosition(x, y);
    image.setScale(scale);
};

// Fits dialog art using the smaller screen side
export const fitImageByScreenMinSide = (
    image: Phaser.GameObjects.Image,
    screenWidth: number,
    screenHeight: number,
    insetRatio = 0.08
) => {
    const sourceWidth = image.width || 1;
    const sourceHeight = image.height || 1;
    const availableWidth = screenWidth * (1 - insetRatio);
    const availableHeight = screenHeight * (1 - insetRatio);
    const scale = screenWidth <= screenHeight
        ? availableWidth / sourceWidth
        : availableHeight / sourceHeight;

    image.setOrigin(0.5);
    image.setPosition(screenWidth / 2, screenHeight / 2);
    image.setScale(scale);
};

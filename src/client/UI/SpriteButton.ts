import Phaser from 'phaser';

type SpriteButtonConfig = {
    scene: Phaser.Scene;
    x: number;
    y: number;
    size: number;
    backgroundTexture: string;
    backgroundAnimation: string;
    backgroundDisabledFrame?: number;
    iconTexture?: string;
    iconAnimation?: string;
    text?: string;
    fontSize?: number;
    flipX?: boolean;
    onClick?: () => void | Promise<void>;
    onPress?: () => void;
    onRelease?: () => void;
};

export class SpriteButton extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Sprite;
    private icon: Phaser.GameObjects.Sprite | undefined;
    private text: Phaser.GameObjects.Text | undefined;
    private size: number;
    private disabled = false;
    private showDisabledFrame = true;
    private isPressed = false;
    private backgroundAnimation: string;
    private backgroundDisabledFrame: number | undefined;
    private iconAnimation: string | undefined;
    private onClick: (() => void | Promise<void>) | undefined;
    private onPress: (() => void) | undefined;
    private onRelease: (() => void) | undefined;

    constructor(cfg: SpriteButtonConfig) {
        super(cfg.scene, cfg.x, cfg.y);

        this.size = cfg.size;
        this.backgroundAnimation = cfg.backgroundAnimation;
        this.backgroundDisabledFrame = cfg.backgroundDisabledFrame;
        this.iconAnimation = cfg.iconAnimation;
        this.onClick = cfg.onClick;
        this.onPress = cfg.onPress;
        this.onRelease = cfg.onRelease;

        this.background = cfg.scene.add.sprite(0, 0, cfg.backgroundTexture).setOrigin(0.5);
        this.background.setFlipX(cfg.flipX ?? false);
        this.add(this.background);

        if (cfg.iconTexture) {
            this.icon = cfg.scene.add.sprite(0, 0, cfg.iconTexture).setOrigin(0.5);
            this.icon.setFlipX(cfg.flipX ?? false);
            this.add(this.icon);
        }

        if (cfg.text) {
            this.text = cfg.scene.add.text(0, 0, cfg.text, {
                color: '#2f2118',
                fontSize: `${cfg.fontSize ?? 24}px`,
                fontStyle: 'bold',
                align: 'center',
                stroke: '#fff4c2',
                strokeThickness: 2,
            }).setOrigin(0.5);
            this.add(this.text);
        }

        this.resize(cfg.size);
        this.refreshAnimationState();
        this.background.setInteractive({ useHandCursor: true });
        this.bindInput();
        cfg.scene.add.existing(this);
    }

    // Updates disabled visual state
    public setDisabled(isDisabled: boolean, showDisabledFrame = true) {
        this.disabled = isDisabled;
        this.showDisabledFrame = showDisabledFrame;
        this.refreshAnimationState();
    }

    // Changes the icon sprite
    public setIcon(texture: string, animation: string) {
        this.iconAnimation = animation;

        if (!this.icon) {
            this.icon = this.scene.add.sprite(0, 0, texture).setOrigin(0.5);
            this.add(this.icon);
        } else {
            this.icon.setTexture(texture);
        }

        this.icon.setVisible(true);
        this.icon.setDisplaySize(this.size, this.size);
        this.text?.setVisible(false);
        this.refreshAnimationState();
    }

    // Shows text instead of an icon
    public setText(value: string) {
        if (!this.text) {
            this.text = this.scene.add.text(0, 0, value, {
                color: '#2f2118',
                fontSize: '24px',
                fontStyle: 'bold',
                align: 'center',
                stroke: '#fff4c2',
                strokeThickness: 2,
            }).setOrigin(0.5);
            this.add(this.text);
        }

        this.text.setText(value);
        this.text.setVisible(true);
        this.icon?.setVisible(false);
    }

    // Resizes the square button
    public resize(size: number) {
        this.size = size;
        this.setSize(size, size);
        this.applyVisualScale(1);
    }

    // Wires pointer interactions
    private bindInput() {
        this.background.on('pointerover', () => {
            if (!this.disabled) this.applyVisualScale(1.05);
        });
        this.background.on('pointerout', () => {
            if (this.isPressed) this.releasePress();
            this.applyVisualScale(1);
        });
        this.background.on('pointerdown', () => {
            if (this.disabled) return;
            this.isPressed = true;
            this.applyVisualScale(0.94);
            this.onPress?.();
        });
        this.background.on('pointerup', () => {
            if (this.disabled) return;
            const wasPressed = this.isPressed;
            this.releasePress();
            if (wasPressed) void this.onClick?.();
        });
        this.background.on('pointerupoutside', () => {
            if (this.isPressed) this.releasePress();
        });
    }

    // Ends a hold interaction
    private releasePress() {
        this.isPressed = false;
        this.applyVisualScale(1);
        this.onRelease?.();
    }

    // Applies current animation or disabled frame
    private refreshAnimationState() {
        if (!this.scene || !this.active || !this.background?.scene || !this.background.active) return;

        const shouldUseDisabledFrame = this.disabled && this.showDisabledFrame && this.backgroundDisabledFrame !== undefined;

        if (shouldUseDisabledFrame) {
            this.background.anims?.stop();
            this.background.setFrame(this.backgroundDisabledFrame ?? 0);
        } else if (this.scene.anims.exists(this.backgroundAnimation)) {
            this.background.play(this.backgroundAnimation, true);
        }

        if (!this.icon || !this.icon.scene || !this.icon.active) {
            this.applyVisualScale(1);
            return;
        }

        if (this.disabled && this.showDisabledFrame) {
            this.icon.anims?.stop();
            this.icon.setFrame(0);
        } else if (this.iconAnimation && this.scene.anims.exists(this.iconAnimation)) {
            this.icon.play(this.iconAnimation, true);
        }

        this.applyVisualScale(1);
    }

    // Applies hover or press scale
    private applyVisualScale(scale: number) {
        if (!this.background?.scene || !this.background.active) return;

        const size = this.size * scale;
        this.background.setDisplaySize(size, size);
        if (this.icon?.scene && this.icon.active) this.icon.setDisplaySize(size, size);
        this.text?.setScale(scale);
    }
}

import Phaser from 'phaser';

type TextSpriteButtonConfig = {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width: number;
    height: number;
    backgroundTexture: string;
    backgroundAnimation: string;
    contentTexture?: string;
    contentAnimation?: string;
    label?: string;
    fontSize?: number;
    onClick: () => void | Promise<void>;
};

const SMALL_TEXT_BUTTON_CONTENT: Record<string, string> = {
    CANCEL: 'small_text_button_cancel',
    LEAVE: 'small_text_button_leave',
    OK: 'small_text_button_ok',
};

export class TextSpriteButton extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Sprite;
    private content: Phaser.GameObjects.Sprite | undefined;
    private label: Phaser.GameObjects.Text | undefined;
    private widthValue: number;
    private heightValue: number;
    private disabled = false;
    private backgroundAnimation: string;
    private onClick: () => void | Promise<void>;

    constructor(cfg: TextSpriteButtonConfig) {
        super(cfg.scene, cfg.x, cfg.y);

        this.widthValue = cfg.width;
        this.heightValue = cfg.height;
        this.backgroundAnimation = cfg.backgroundAnimation;
        this.onClick = cfg.onClick;

        this.background = cfg.scene.add.sprite(0, 0, cfg.backgroundTexture).setOrigin(0.5);
        this.background.play(cfg.backgroundAnimation);
        this.add(this.background);

        if (cfg.contentTexture) {
            this.setContent(cfg.contentTexture, cfg.contentAnimation ?? `${cfg.contentTexture}_active`);
        } else if (cfg.label) {
            this.setLabel(cfg.label, cfg.fontSize);
        }

        this.resize(cfg.width, cfg.height, cfg.fontSize);
        this.background.setInteractive({ useHandCursor: true });
        this.bindInput();
        cfg.scene.add.existing(this);
    }

    public setLabel(text: string, fontSize?: number) {
        const contentTexture = SMALL_TEXT_BUTTON_CONTENT[text.toUpperCase()];
        if (contentTexture && this.scene.textures.exists(contentTexture)) {
            this.setContent(contentTexture, `${contentTexture}_active`);
            return;
        }

        this.content?.setVisible(false);
        if (!this.label) {
            this.label = this.scene.add.text(0, 0, text, {
                color: '#2f2118',
                fontSize: `${fontSize ?? 18}px`,
                fontStyle: 'bold',
                align: 'center',
                stroke: '#fff4c2',
                strokeThickness: 2,
            }).setOrigin(0.5);
            this.add(this.label);
        }

        this.label.setText(text);
        if (fontSize) this.label.setFontSize(fontSize);
        this.label.setVisible(true);
    }

    public setContent(texture: string, animation = `${texture}_active`) {
        this.label?.setVisible(false);

        if (!this.content) {
            this.content = this.scene.add.sprite(0, 0, texture).setOrigin(0.5);
            this.add(this.content);
        } else {
            this.content.setTexture(texture);
        }

        this.content.setVisible(true);
        if (this.scene.anims.exists(animation)) this.content.play(animation, true);
        this.applyDisplaySize(1);
    }

    public setDisabled(isDisabled: boolean) {
        this.disabled = isDisabled;
        this.setAlpha(isDisabled ? 0.55 : 1);
        this.background.play(this.backgroundAnimation, true);
        if (this.content?.visible) this.content.anims.resume();
    }

    public resize(width: number, height: number, fontSize?: number) {
        this.widthValue = width;
        this.heightValue = height;
        this.setSize(width, height);
        if (fontSize) this.label?.setFontSize(fontSize);
        this.applyDisplaySize(1);
    }

    private bindInput() {
        this.background.on('pointerover', () => {
            if (!this.disabled) this.applyDisplaySize(1.02);
        });
        this.background.on('pointerout', () => {
            this.applyDisplaySize(1);
        });
        this.background.on('pointerdown', () => {
            if (!this.disabled) this.applyDisplaySize(0.97);
        });
        this.background.on('pointerup', () => {
            if (this.disabled) return;
            this.applyDisplaySize(1);
            void this.onClick();
        });
    }

    private applyDisplaySize(scale: number) {
        const sourceWidth = Math.max(this.background.width, 1);
        const sourceHeight = Math.max(this.background.height, 1);
        const baseScale = Math.min(this.widthValue / sourceWidth, this.heightValue / sourceHeight);
        const displayScale = baseScale * scale;

        this.background.setScale(displayScale);
        this.content?.setScale(displayScale);
        this.label?.setScale(scale);
    }
}

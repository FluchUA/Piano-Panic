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
    labelColor?: string;
    labelStrokeColor?: string;
    labelStrokeThickness?: number;
    inlineIconTexture?: string;
    inlineIconMaxHeight?: number;
    inlineIconGap?: number;
    onClick: () => void | Promise<void>;
};

const SMALL_TEXT_BUTTON_CONTENT: Record<string, string> = {
    CANCEL: 'small_text_button_cancel',
    CLEAR: 'small_text_button_clear',
    DELETE: 'small_text_button_delete',
    LEAVE: 'small_text_button_leave',
    OK: 'small_text_button_ok',
    PUBLISH: 'small_text_button_publish',
    SAVE: 'small_text_button_save',
};

export class TextSpriteButton extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Sprite;
    private content: Phaser.GameObjects.Sprite | undefined;
    private label: Phaser.GameObjects.Text | undefined;
    private inlineIcon: Phaser.GameObjects.Image | undefined;
    private widthValue: number;
    private heightValue: number;
    private disabled = false;
    private backgroundAnimation: string;
    private onClick: () => void | Promise<void>;
    private labelColor: string;
    private labelStrokeColor: string;
    private labelStrokeThickness: number;
    private inlineIconMaxHeight: number | undefined;
    private inlineIconGap: number;

    constructor(cfg: TextSpriteButtonConfig) {
        super(cfg.scene, cfg.x, cfg.y);

        this.widthValue = cfg.width;
        this.heightValue = cfg.height;
        this.backgroundAnimation = cfg.backgroundAnimation;
        this.onClick = cfg.onClick;
        this.labelColor = cfg.labelColor ?? '#2f2118';
        this.labelStrokeColor = cfg.labelStrokeColor ?? '#fff4c2';
        this.labelStrokeThickness = cfg.labelStrokeThickness ?? 2;
        this.inlineIconMaxHeight = cfg.inlineIconMaxHeight;
        this.inlineIconGap = cfg.inlineIconGap ?? 4;

        this.background = cfg.scene.add.sprite(0, 0, cfg.backgroundTexture).setOrigin(0.5);
        if (cfg.scene.anims.exists(cfg.backgroundAnimation)) this.background.play(cfg.backgroundAnimation);
        this.add(this.background);

        if (cfg.inlineIconTexture) {
            this.inlineIcon = cfg.scene.add.image(0, 0, cfg.inlineIconTexture)
                .setOrigin(0.5)
                .setVisible(false);
            this.add(this.inlineIcon);
        }

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

    // Sets text or a matching text sprite
    public setLabel(text: string, fontSize?: number) {
        const contentTexture = SMALL_TEXT_BUTTON_CONTENT[text.toUpperCase()];
        if (contentTexture && this.scene.textures.exists(contentTexture)) {
            this.setContent(contentTexture, `${contentTexture}_active`);
            return;
        }

        this.content?.setVisible(false);
        if (!this.label) {
            this.label = this.scene.add.text(0, 0, text, {
                color: this.labelColor,
                fontSize: `${fontSize ?? 18}px`,
                fontStyle: 'bold',
                align: 'center',
                stroke: this.labelStrokeColor,
                strokeThickness: this.labelStrokeThickness,
            }).setOrigin(0.5);
            this.add(this.label);
        }

        this.label.setText(text);
        if (fontSize) this.label.setFontSize(fontSize);
        this.label.setVisible(true);
        this.inlineIcon?.setVisible(Boolean(this.inlineIcon && text.toUpperCase() !== 'SOLD'));
        this.applyDisplaySize(1);
    }

    // Sets animated sprite content
    public setContent(texture: string, animation = `${texture}_active`) {
        this.label?.setVisible(false);
        this.inlineIcon?.setVisible(false);

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

    // Updates disabled visual state
    public setDisabled(isDisabled: boolean) {
        this.disabled = isDisabled;
        this.setAlpha(isDisabled ? 0.55 : 1);
        if (this.isSpriteAlive(this.background) && this.scene.anims.exists(this.backgroundAnimation)) {
            this.background.play(this.backgroundAnimation, true);
        }
        const content = this.content;
        if (this.isSpriteAlive(content) && content.visible) content.anims?.resume();
    }

    // Resizes the button
    public resize(width: number, height: number, fontSize?: number) {
        this.widthValue = width;
        this.heightValue = height;
        this.setSize(width, height);
        if (fontSize) this.label?.setFontSize(fontSize);
        this.applyDisplaySize(1);
    }

    // Wires pointer interactions
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

    // Applies proportional visual scale
    private applyDisplaySize(scale: number) {
        if (!this.isSpriteAlive(this.background)) return;

        const sourceWidth = Math.max(this.background.width, 1);
        const sourceHeight = Math.max(this.background.height, 1);
        const baseScale = Math.min(this.widthValue / sourceWidth, this.heightValue / sourceHeight);
        const displayScale = baseScale * scale;

        this.background.setScale(displayScale);
        const content = this.content;
        if (this.isSpriteAlive(content)) content.setScale(displayScale);
        this.label?.setScale(scale);
        this.layoutInlineContent(scale);
    }

    // Checks if a sprite can still be touched
    private isSpriteAlive(sprite: Phaser.GameObjects.Sprite | undefined): sprite is Phaser.GameObjects.Sprite {
        return Boolean(sprite?.scene && sprite.active);
    }

    // Places label and inline icon together
    private layoutInlineContent(scale: number) {
        if (!this.label?.visible) return;

        if (!this.inlineIcon?.visible) {
            this.label.setPosition(0, 0);
            return;
        }

        const maxWidth = this.widthValue * 0.68;
        const iconHeight = Math.min(this.inlineIconMaxHeight ?? this.heightValue * 0.42, this.heightValue * 0.5) * scale;
        const iconScale = iconHeight / Math.max(1, this.inlineIcon.height);
        const gap = this.inlineIconGap * scale;

        this.label.setScale(scale);
        this.inlineIcon.setScale(iconScale);

        let resolvedGap = gap;
        let groupWidth = this.label.displayWidth + resolvedGap + this.inlineIcon.displayWidth;
        if (groupWidth > maxWidth) {
            const shrink = maxWidth / groupWidth;
            this.label.setScale(scale * shrink);
            this.inlineIcon.setScale(iconScale * shrink);
            resolvedGap = gap * shrink;
            groupWidth = this.label.displayWidth + resolvedGap + this.inlineIcon.displayWidth;
        }

        const startX = -groupWidth / 2;
        this.label.setPosition(startX + this.label.displayWidth / 2, 0);
        this.inlineIcon.setPosition(startX + this.label.displayWidth + resolvedGap + this.inlineIcon.displayWidth / 2, 0);
    }
}

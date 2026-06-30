import Phaser from 'phaser';

type ToonButtonConfig = {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    onClick: () => void | Promise<void>;
    fontSize?: number;
};

export class ToonButton extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private label: Phaser.GameObjects.Text;
    private disabled = false;
    private onClick: () => void | Promise<void>;

    constructor(cfg: ToonButtonConfig) {
        super(cfg.scene, cfg.x, cfg.y);

        this.onClick = cfg.onClick;

        this.background = cfg.scene.add.rectangle(0, 0, cfg.width, cfg.height, 0xf8d66d, 1)
            .setStrokeStyle(4, 0x2f2118)
            .setOrigin(0.5);

        this.label = cfg.scene.add.text(0, 0, cfg.label, {
            color: '#2f2118',
            fontSize: `${cfg.fontSize ?? 20}px`,
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: cfg.width - 24 },
        }).setOrigin(0.5);

        this.add([this.background, this.label]);
        this.setSize(cfg.width, cfg.height);
        this.background.setInteractive({ useHandCursor: true });

        this.background.on('pointerover', () => {
            if (!this.disabled) this.background.setFillStyle(0xffec99);
        });
        this.background.on('pointerout', () => {
            if (!this.disabled) this.background.setFillStyle(0xf8d66d);
            this.background.setScale(1);
            this.label.setScale(1);
        });
        this.background.on('pointerdown', () => {
            if (this.disabled) return;
            this.background.setScale(0.96);
            this.label.setScale(0.96);
        });
        this.background.on('pointerup', () => {
            if (this.disabled) return;
            this.background.setScale(1);
            this.label.setScale(1);
            void this.onClick();
        });

        cfg.scene.add.existing(this);
    }

    public setLabel(text: string) {
        this.label.setText(text);
    }

    public setDisabled(isDisabled: boolean) {
        this.disabled = isDisabled;
        this.setAlpha(isDisabled ? 0.55 : 1);
        this.background.setFillStyle(isDisabled ? 0x9a9a9a : 0xf8d66d);
        this.background.setScale(1);
        this.label.setScale(1);
    }

    public resize(width: number, height: number, fontSize?: number) {
        this.background.setSize(width, height);
        this.label.setWordWrapWidth(width - 24);
        if (fontSize) this.label.setFontSize(fontSize);
        this.setSize(width, height);
    }
}

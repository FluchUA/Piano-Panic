import Phaser from 'phaser';
import { ToonButton } from './ToonButton';

type ConfirmDialogConfig = {
    scene: Phaser.Scene;
};

type OpenConfirmConfig = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
};

export class ConfirmDialog extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private panel: Phaser.GameObjects.Rectangle;
    private title: Phaser.GameObjects.Text;
    private message: Phaser.GameObjects.Text;
    private confirmButton: ToonButton;
    private cancelButton: ToonButton;
    private onConfirm: () => void | Promise<void> = () => undefined;
    private resizeHandler: () => void;
    private ownerScene: Phaser.Scene;

    constructor(cfg: ConfirmDialogConfig) {
        super(cfg.scene, 0, 0);
        this.ownerScene = cfg.scene;
        this.resizeHandler = () => this.refreshLayout();

        const { width, height } = cfg.scene.scale;

        this.background = cfg.scene.add.rectangle(0, 0, width, height, 0x000000, 0.72)
            .setOrigin(0)
            .setInteractive();

        this.panel = cfg.scene.add.rectangle(width / 2, height / 2, width * 0.82, height * 0.58, 0x16100d)
            .setStrokeStyle(4, 0xffffff);

        this.title = cfg.scene.add.text(width / 2, height * 0.32, '', {
            color: '#f8d66d',
            fontSize: '30px',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width * 0.68 },
        }).setOrigin(0.5);

        this.message = cfg.scene.add.text(width / 2, height * 0.46, '', {
            color: '#ffffff',
            fontSize: '22px',
            align: 'center',
            wordWrap: { width: width * 0.68 },
        }).setOrigin(0.5);

        this.confirmButton = new ToonButton({
            scene: cfg.scene,
            x: width / 2 - 100,
            y: height * 0.66,
            width: 180,
            height: 48,
            label: 'Continue',
            onClick: async () => {
                this.close();
                await this.onConfirm();
            },
        });

        this.cancelButton = new ToonButton({
            scene: cfg.scene,
            x: width / 2 + 100,
            y: height * 0.66,
            width: 160,
            height: 48,
            label: 'Cancel',
            onClick: () => this.close(),
        });

        this.add([
            this.background,
            this.panel,
            this.title,
            this.message,
            this.confirmButton,
            this.cancelButton,
        ]);

        this.setDepth(9000);
        this.setVisible(false);

        cfg.scene.scale.on('resize', this.resizeHandler);
        cfg.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
        cfg.scene.add.existing(this);
    }

    public open(cfg: OpenConfirmConfig) {
        this.onConfirm = cfg.onConfirm;
        this.title.setText(cfg.title);
        this.message.setText(cfg.message);
        this.confirmButton.setLabel(cfg.confirmLabel ?? 'Continue');
        this.cancelButton.setLabel(cfg.cancelLabel ?? 'Cancel');
        this.refreshLayout();
        this.setVisible(true);
    }

    public close() {
        this.setVisible(false);
    }

    public override destroy(fromScene?: boolean) {
        this.ownerScene.scale.off('resize', this.resizeHandler);
        super.destroy(fromScene);
    }

    private refreshLayout() {
        const { width, height } = this.ownerScene.scale;
        const isCompact = width < 520;
        const panelWidth = Math.min(520, width * 0.86);
        const panelHeight = isCompact ? height * 0.66 : height * 0.58;

        this.background.setSize(width, height);
        this.panel.setPosition(width / 2, height / 2);
        this.panel.setSize(panelWidth, panelHeight);
        this.title.setPosition(width / 2, height * 0.29);
        this.title.setWordWrapWidth(panelWidth * 0.82);
        this.message.setPosition(width / 2, height * 0.43);
        this.message.setWordWrapWidth(panelWidth * 0.82);

        if (isCompact) {
            this.confirmButton.resize(panelWidth * 0.68, 46, 16);
            this.cancelButton.resize(panelWidth * 0.68, 46, 16);
            this.confirmButton.setPosition(width / 2, height * 0.63);
            this.cancelButton.setPosition(width / 2, height * 0.73);
            return;
        }

        const buttonGap = Math.min(220, width * 0.26);
        this.confirmButton.resize(180, 48, 18);
        this.cancelButton.resize(160, 48, 18);
        this.confirmButton.setPosition(width / 2 - buttonGap / 2, height * 0.66);
        this.cancelButton.setPosition(width / 2 + buttonGap / 2, height * 0.66);
    }
}

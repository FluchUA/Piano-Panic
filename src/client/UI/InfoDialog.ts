import Phaser from 'phaser';
import { ToonButton } from './ToonButton';

type DialogConfig = {
    scene: Phaser.Scene;
};

export class InfoDialog extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private panel: Phaser.GameObjects.Rectangle;
    private text: Phaser.GameObjects.Text;
    private okButton: ToonButton;
    private resizeHandler: () => void;
    private ownerScene: Phaser.Scene;

    constructor(cfg: DialogConfig) {
        super(cfg.scene, 0, 0);
        this.ownerScene = cfg.scene;
        this.resizeHandler = () => this.refreshLayout();

        const { width, height } = cfg.scene.scale;

        this.background = cfg.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive();

        this.panel = cfg.scene.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.7, 0x111111)
            .setStrokeStyle(4, 0xffffff);

        this.text = cfg.scene.add.text(width / 2, height / 2 - 24, '', {
            color: '#ffffff',
            fontSize: '22px',
            align: 'center',
            wordWrap: { width: width * 0.68 },
        }).setOrigin(0.5);

        this.okButton = new ToonButton({
            scene: cfg.scene,
            x: width / 2,
            y: height * 0.78,
            width: 160,
            height: 48,
            label: 'OK',
            onClick: () => this.close(),
        });

        this.add([this.background, this.panel, this.text, this.okButton]);
        this.setDepth(9000);
        this.setVisible(false);

        cfg.scene.scale.on('resize', this.resizeHandler);
        cfg.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
        cfg.scene.add.existing(this);
    }

    public open(text: string) {
        this.text.setText(text.trim());
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

        this.background.setSize(width, height);
        this.panel.setPosition(width / 2, height / 2);
        this.panel.setSize(width * 0.8, height * 0.7);
        this.text.setPosition(width / 2, height / 2 - 24);
        this.text.setWordWrapWidth(width * 0.68);
        this.okButton.setPosition(width / 2, height * 0.78);
    }
}

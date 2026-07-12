import Phaser from 'phaser';
import { TextSpriteButton } from './TextSpriteButton';
import { fitImageByScreenMinSide } from '../utils/sceneBackground';

type DialogConfig = {
    scene: Phaser.Scene;
};

export class InfoDialog extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private panel: Phaser.GameObjects.Image;
    private text: Phaser.GameObjects.Text;
    private okButton: TextSpriteButton;
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

        this.panel = cfg.scene.add.image(width / 2, height / 2, 'dialog_bg');

        this.text = cfg.scene.add.text(width / 2, height / 2 - 24, '', {
            color: '#ffffff',
            fontSize: '22px',
            align: 'center',
            wordWrap: { width: width * 0.68 },
        }).setOrigin(0.5);

        this.okButton = new TextSpriteButton({
            scene: cfg.scene,
            x: width / 2,
            y: height * 0.78,
            width: 160,
            height: 46,
            backgroundTexture: 'small_text_button_bg',
            backgroundAnimation: 'small_text_button_bg_active',
            contentTexture: 'small_text_button_ok',
            contentAnimation: 'small_text_button_ok_active',
            onClick: () => this.close(),
        });

        this.add([this.background, this.panel, this.text, this.okButton]);
        this.setDepth(9000);
        this.setVisible(false);

        cfg.scene.scale.on('resize', this.resizeHandler);
        cfg.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
        cfg.scene.add.existing(this);
    }

    // Opens the info dialog
    public open(text: string) {
        this.text.setText(text.trim());
        this.refreshLayout();
        this.setVisible(true);
    }

    // Hides the dialog
    public close() {
        this.setVisible(false);
    }

    // Removes resize listeners
    public override destroy(fromScene?: boolean) {
        this.ownerScene.scale.off('resize', this.resizeHandler);
        super.destroy(fromScene);
    }

    // Repositions dialog content
    private refreshLayout() {
        const { width, height } = this.ownerScene.scale;

        this.background.setSize(width, height);
        fitImageByScreenMinSide(this.panel, width, height);

        const panelWidth = this.panel.displayWidth;
        const panelHeight = this.panel.displayHeight;
        const panelX = this.panel.x;
        const panelY = this.panel.y;

        this.text.setPosition(panelX, panelY - panelHeight * 0.06);
        this.text.setWordWrapWidth(panelWidth * 0.66);
        this.okButton.resize(Math.min(160, panelWidth * 0.5), 46);
        this.okButton.setPosition(panelX, panelY + panelHeight * 0.34);
    }
}

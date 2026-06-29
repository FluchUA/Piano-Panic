import Phaser from "phaser";

type DialogConfig = {
    scene: Phaser.Scene;
};

export class InfoDialog extends Phaser.GameObjects.Container {
    private text!: Phaser.GameObjects.Text;

    constructor(cfg: DialogConfig) {
        super(cfg.scene);

        const { width, height } = cfg.scene.scale;

        const bg = cfg.scene.add.rectangle(
            0,
            0,
            width,
            height,
            0x000000,
            0.7
        )
        .setOrigin(0)
        .setInteractive();

        bg.on("pointerdown", () => this.close());

        const panel = cfg.scene.add.rectangle(
            width / 2,
            height / 2,
            width * 0.8,
            height * 0.7,
            0x111111
        );

        this.text = cfg.scene.add.text(
            width / 2,
            height / 2,
            "",
            {
                color: "#ffffff",
                wordWrap: {
                    width: width * 0.7
                }
            }
        )
        .setOrigin(0.5);

        this.add([
            bg,
            panel,
            this.text
        ]);

        this.setVisible(false);

        cfg.scene.add.existing(this);
    }

    public open(text: string) {
        this.text.setText(text);
        this.setVisible(true);
    }

    public close() {
        this.setVisible(false);
    }
}
import Phaser from 'phaser';

export class LoaderOverlay extends Phaser.GameObjects.Container {
    private spinner!: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        super(scene, 0, 0);
        const { width, height } = scene.scale;

        const background = scene.add.rectangle(0, 0, width, height, 0x000000, 0.6);
        background.setOrigin(0, 0);
        background.setInteractive();

        this.spinner = scene.add.text(width / 2, height / 2, 'LOADING...', {
            fontSize: '42px',
            color: '#fff',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add([background, this.spinner]);
        
        this.setVisible(false);
        this.setDepth(9999);

        scene.tweens.add({
            targets: this.spinner,
            scaleY: 0.8,
            scaleX: 1.1,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        window.addEventListener('SHOW_PHASER_LOADER', () => this.setVisible(true));
        window.addEventListener('HIDE_PHASER_LOADER', () => this.setVisible(false));

        scene.add.existing(this);
    }
}
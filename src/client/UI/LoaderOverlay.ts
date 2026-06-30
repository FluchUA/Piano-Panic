import Phaser from 'phaser';

export class LoaderOverlay extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private spinner!: Phaser.GameObjects.Text;
    private showHandler: () => void;
    private hideHandler: () => void;
    private resizeHandler: () => void;
    private activeRequests = 0;

    constructor(scene: Phaser.Scene) {
        super(scene, 0, 0);
        const { width, height } = scene.scale;

        this.background = scene.add.rectangle(0, 0, width, height, 0x000000, 0.6);
        this.background.setOrigin(0, 0);
        this.background.setInteractive();

        this.spinner = scene.add.text(width / 2, height / 2, 'LOADING...', {
            fontSize: '42px',
            color: '#fff',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add([this.background, this.spinner]);
        
        this.setVisible(false);
        this.setDepth(9999);
        this.setSize(width, height);

        scene.tweens.add({
            targets: this.spinner,
            scaleY: 0.8,
            scaleX: 1.1,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.showHandler = () => {
            this.activeRequests += 1;
            this.refreshLayout();
            this.setVisible(true);
            scene.scene.bringToTop();
        };

        this.hideHandler = () => {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            if (this.activeRequests === 0) this.setVisible(false);
        };
        this.resizeHandler = () => this.refreshLayout();

        window.addEventListener('SHOW_PHASER_LOADER', this.showHandler);
        window.addEventListener('HIDE_PHASER_LOADER', this.hideHandler);
        scene.scale.on('resize', this.resizeHandler);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

        scene.add.existing(this);
    }

    public override destroy(fromScene?: boolean) {
        window.removeEventListener('SHOW_PHASER_LOADER', this.showHandler);
        window.removeEventListener('HIDE_PHASER_LOADER', this.hideHandler);
        this.scene.scale.off('resize', this.resizeHandler);
        super.destroy(fromScene);
    }

    private refreshLayout() {
        const { width, height } = this.scene.scale;

        this.background.setSize(width, height);
        this.spinner.setPosition(width / 2, height / 2);
        this.setSize(width, height);
    }
}

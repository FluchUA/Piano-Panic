import Phaser from 'phaser';

export class LoaderOverlay extends Phaser.GameObjects.Container {
    private firstLoadBackground: Phaser.GameObjects.Rectangle;
    private firstLoadText: Phaser.GameObjects.Text;
    private blocker: Phaser.GameObjects.Rectangle;
    private progress: Phaser.GameObjects.Sprite | undefined;
    private showHandler: () => void;
    private hideHandler: () => void;
    private hideInitialHandler: () => void;
    private resizeHandler: () => void;
    private activeRequests = 0;
    private isInitialLoad = true;

    constructor(
        scene: Phaser.Scene,
        firstLoadBackground: Phaser.GameObjects.Rectangle,
        firstLoadText: Phaser.GameObjects.Text
    ) {
        super(scene, 0, 0);
        const { width, height } = scene.scale;

        this.firstLoadBackground = firstLoadBackground;
        this.firstLoadText = firstLoadText;
        this.blocker = scene.add.rectangle(0, 0, width, height, 0x000000, 0.68)
            .setOrigin(0)
            .setInteractive();
        this.blocker.setVisible(false);

        this.add([this.firstLoadBackground, this.blocker, this.firstLoadText]);
        
        this.setVisible(true);
        this.setDepth(9999);
        this.setSize(width, height);

        this.showHandler = () => {
            this.activeRequests += 1;
            this.refreshLayout();
            this.updateVisibleContent();
            this.setVisible(true);
            scene.scene.bringToTop();
        };

        this.hideHandler = () => {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            if (this.activeRequests === 0 && !this.isInitialLoad) this.setVisible(false);
        };
        this.hideInitialHandler = () => {
            this.isInitialLoad = false;
            this.updateVisibleContent();
            if (this.activeRequests === 0) this.setVisible(false);
        };
        this.resizeHandler = () => this.refreshLayout();

        window.addEventListener('SHOW_PHASER_LOADER', this.showHandler);
        window.addEventListener('HIDE_PHASER_LOADER', this.hideHandler);
        window.addEventListener('HIDE_INITIAL_PHASER_LOADER', this.hideInitialHandler);
        scene.scale.on('resize', this.resizeHandler);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());

        scene.add.existing(this);
        this.refreshLayout();
    }

    public override destroy(fromScene?: boolean) {
        window.removeEventListener('SHOW_PHASER_LOADER', this.showHandler);
        window.removeEventListener('HIDE_PHASER_LOADER', this.hideHandler);
        window.removeEventListener('HIDE_INITIAL_PHASER_LOADER', this.hideInitialHandler);
        this.scene.scale.off('resize', this.resizeHandler);
        super.destroy(fromScene);
    }

    private updateVisibleContent() {
        this.firstLoadBackground.setVisible(this.isInitialLoad);
        this.firstLoadText.setVisible(this.isInitialLoad);
        this.blocker.setVisible(!this.isInitialLoad);

        if (this.isInitialLoad) {
            this.progress?.setVisible(false);
            return;
        }

        if (this.scene.textures.exists('progress_anim')) {
            this.ensureProgressSprite();
            this.progress?.setVisible(true);
            return;
        }

        this.progress?.setVisible(false);
        this.firstLoadText.setVisible(true);
    }

    private ensureProgressSprite() {
        if (this.progress || !this.scene.textures.exists('progress_anim')) return;

        const { width, height } = this.scene.scale;
        const progressSize = Math.min(width, height);
        this.progress = this.scene.add.sprite(width / 2, height / 2, 'progress_anim')
            .setOrigin(0.5)
            .setDisplaySize(progressSize, progressSize);
        if (this.scene.anims.exists('progress_loop')) this.progress.play('progress_loop');
        this.add(this.progress);
    }

    private refreshLayout() {
        const { width, height } = this.scene.scale;

        this.firstLoadBackground.setSize(width, height);
        this.firstLoadText.setPosition(width / 2, height / 2);
        this.blocker.setSize(width, height);
        const progressSize = Math.min(width, height);
        this.progress?.setPosition(width / 2, height / 2);
        this.progress?.setDisplaySize(progressSize, progressSize);
        this.setSize(width, height);
    }
}

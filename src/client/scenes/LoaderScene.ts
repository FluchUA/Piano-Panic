import { Scene } from 'phaser';
import { LoaderOverlay } from '../UI/LoaderOverlay';

export class LoaderScene extends Scene {
    constructor() {
        super('LoaderScene');
    }

    create() {
        const { width, height } = this.scale;
        const firstLoadBackground = this.add.rectangle(0, 0, width, height, 0x5F0E0E, 1)
            .setOrigin(0);
        const firstLoadText = this.add.text(width / 2, height / 2, 'LOADING...', {
            fontSize: '42px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5);
        this.tweens.add({
            targets: firstLoadText,
            scaleX: 1.1,
            scaleY: 0.8,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        new LoaderOverlay(this, firstLoadBackground, firstLoadText);
    }
}

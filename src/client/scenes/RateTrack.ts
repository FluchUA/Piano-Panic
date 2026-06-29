import { Scene } from 'phaser';
import { InfoDialog } from '../UI/InfoDialog';
import { AnimatedButton } from '../UI/AnimatedButton';

export class RateTrackScene extends Scene {
    private dialog!: InfoDialog;

    constructor() {
        super('RateTrackScene');
    }

    create() {
        const { width } = this.scale;

        // Title
        this.add.text(width / 2, 40, 'Rate Track', {
            fontSize: '36px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // Back button
        new AnimatedButton({
            scene: this,
            x: 60,
            y: 50,
            texture: 'backButton',
            animationKey: 'button_test_key',

            onClick: () => {
                this.scene.start('MainMenu');
            }
        });

        // Dialog
        this.dialog = new InfoDialog({  scene: this });

        // Info button
        new AnimatedButton({
            scene: this,
            x: width - 60,
            y: 50,
            texture: 'infoButton',
            animationKey: 'button_test_key',

            onClick: () => {
                this.dialog.open(`
                    This is Rate Track mode.

                    Here you can rate tracks created by other users.

                    If the text is too long,
                    it can be scrolled.
                `);
            }
        });

        // Здесь уже логика самой сцены
        // список треков
        // рейтинг
        // карточки
        // и т.д.
    }
}
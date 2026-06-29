import { Scene, GameObjects } from 'phaser';
import { RedditAPI } from '../utils/RedditAPI';
import { TrackModel } from '../../shared/api';

export class UserRecordsScene extends Scene {
    private page = 1;
    private limit = 5;

    private listContainer!: GameObjects.Container;

    private emptyText!: GameObjects.Text;
    private errorText!: GameObjects.Text;

    private prevButton!: GameObjects.Text;
    private nextButton!: GameObjects.Text;

    private currentTracks: TrackModel[] = [];

    constructor() {
        super('UserRecordsScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.text(width / 2, 40, 'My Vinyl Records', {
            fontSize: '36px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const backBtn = this.add.text(20, 20, '← Back', {
            fontSize: '28px',
            color: '#ffffff',
            backgroundColor: '#222',
            padding: {
                left: 10,
                right: 10,
                top: 6,
                bottom: 6,
            },
        })
        .setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });

        this.emptyText = this.add.text(
            width / 2,
            height / 2,
            'No records found',
            {
                fontSize: '28px',
                color: '#ffffff',
            }
        )
        .setOrigin(0.5)
        .setVisible(false);

        this.errorText = this.add.text(
            width / 2,
            height / 2 + 50,
            '',
            {
                fontSize: '22px',
                color: '#ff6666',
            }
        )
        .setOrigin(0.5)
        .setVisible(false);

        this.listContainer = this.add.container(0, 0);

        this.prevButton = this.add.text(
            width / 2 - 120,
            height - 60,
            '< Prev',
            {
                fontSize: '24px',
                color: '#ffffff',
                backgroundColor: '#333',
                padding: {
                    left: 10,
                    right: 10,
                    top: 6,
                    bottom: 6,
                },
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        this.prevButton.on('pointerdown', () => {
            if (this.page > 1) {
                this.page--;
                this.loadTracks();
            }
        });

        this.nextButton = this.add.text(
            width / 2 + 120,
            height - 60,
            'Next >',
            {
                fontSize: '24px',
                color: '#ffffff',
                backgroundColor: '#333',
                padding: {
                    left: 10,
                    right: 10,
                    top: 6,
                    bottom: 6,
                },
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        this.nextButton.on('pointerdown', () => {
            this.page++;
            this.loadTracks();
        });

        this.loadTracks();
    }

    private async loadTracks() {
        this.listContainer.removeAll(true);

        this.emptyText.setVisible(false);
        this.errorText.setVisible(false);

        try {
            const tracks = await RedditAPI.getUserTracks(
                this.page,
                this.limit
            );

            this.currentTracks = tracks;

            if (tracks.length === 0) {
                if (this.page > 1) {
                    this.page--;
                }

                this.emptyText.setVisible(true);

                this.prevButton.setVisible(this.page > 1);
                this.nextButton.setVisible(false);

                return;
            }

            this.renderTracks(tracks);

            this.prevButton.setVisible(this.page > 1);

            // примитивная проверка есть ли следующая страница
            this.nextButton.setVisible(
                tracks.length === this.limit
            );

        } catch (error) {
            console.error(error);

            this.errorText.setText('Failed to load records');
            this.errorText.setVisible(true);
        }
    }

    private renderTracks(tracks: TrackModel[]) {
        const { width } = this.scale;

        const startY = 140;
        const rowHeight = 90;

        tracks.forEach((track, index) => {
            const y = startY + index * rowHeight;

            const row = this.add.container(width / 2, y);

            const name = this.add.text(
                -250,
                0,
                track.name,
                {
                    fontSize: '24px',
                    color: '#ffffff',
                }
            ).setOrigin(0, 0.5);

            row.add(name);

            const playButton = this.createButton(
                0,
                0,
                'Play',
                () => {
                    this.scene.start('PianoScene', {
                        track,
                    });
                }
            );

            row.add(playButton);

            let buttonX = 120;

            if (!track.isPublished) {
                const publishButton = this.createButton(
                    buttonX,
                    0,
                    'Publish',
                    async () => {
                        try {
                            await RedditAPI.publishTrack({
                                trackId: track.id,
                            });

                            await this.loadTracks();
                        } catch (error) {
                            console.error(error);
                        }
                    }
                );

                row.add(publishButton);

                buttonX += 140;
            }

            const deleteButton = this.createButton(
                buttonX,
                0,
                'Delete',
                async () => {
                    try {
                        await RedditAPI.deleteTrack({
                            instrumentId: track.instrumentId,
                        });

                        await this.loadTracks();
                    } catch (error) {
                        console.error(error);
                    }
                }
            );

            row.add(deleteButton);

            this.listContainer.add(row);
        });
    }

    private createButton(
        x: number,
        y: number,
        label: string,
        callback: () => void | Promise<void>
    ): GameObjects.Text {
        const button = this.add.text(
            x,
            y,
            label,
            {
                fontSize: '20px',
                color: '#ffffff',
                backgroundColor: '#444',
                padding: {
                    left: 10,
                    right: 10,
                    top: 6,
                    bottom: 6,
                },
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        button.on('pointerdown', callback);

        return button;
    }
}
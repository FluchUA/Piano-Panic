import Phaser, { Scene } from 'phaser';
import { ConfirmDialog } from '../UI/ConfirmDialog';
import { InfoDialog } from '../UI/InfoDialog';
import { SpriteButton } from '../UI/SpriteButton';
import { RedditAPI } from '../utils/RedditAPI';
import { PUBLISH_REWARD } from '../../shared/economy';
import { coverSceneBackground } from '../utils/sceneBackground';
import type { TrackModel, UserResponse } from '../../shared/api';

type TrackRowView = {
    row: Phaser.GameObjects.Container;
    panel: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.Text;
    meta: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    playButton: SpriteButton;
    publishButton: SpriteButton;
    deleteButton: SpriteButton;
};

export class UserRecordsScene extends Scene {
    private page = 1;
    private limit = 3;
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private emptyText!: Phaser.GameObjects.Text;
    private backButton!: SpriteButton;
    private infoButton!: SpriteButton;
    private prevButton!: SpriteButton;
    private nextButton!: SpriteButton;
    private infoDialog!: InfoDialog;
    private confirmDialog!: ConfirmDialog;
    private hasNextPage = false;
    private rowViews: TrackRowView[] = [];
    private isSceneAlive = false;
    private loadRequestId = 0;
    private resizeHandler = () => this.refreshLayout();

    constructor() {
        super('UserRecordsScene');
    }

    create() {
        this.isSceneAlive = true;
        this.loadRequestId += 1;
        this.page = 1;
        this.hasNextPage = false;
        this.rowViews = [];

        this.background = this.add.image(0, 0, 'user_records_bg').setOrigin(0);

        this.title = this.add.text(0, 0, 'MY VINYL\nRECORDS', {
            fontSize: '40px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 7,
            align: 'center',
        }).setOrigin(0.5);

        this.backButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 70,
            backgroundTexture: 'middle_round_button_bg',
            backgroundAnimation: 'middle_round_button_bg_active',
            iconTexture: 'middle_round_back_icon',
            iconAnimation: 'middle_round_back_icon_active',
            onClick: () => {
                this.scene.start('MainMenu');
            },
        });

        this.infoButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 70,
            backgroundTexture: 'middle_round_button_bg',
            backgroundAnimation: 'middle_round_button_bg_active',
            iconTexture: 'middle_round_info_icon',
            iconAnimation: 'middle_round_info_icon_active',
            onClick: () => this.openInfo(),
        });

        this.emptyText = this.add.text(0, 0, 'No records yet. Compose your first tune!', {
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 520 },
            stroke: '#2f2118',
            strokeThickness: 5,
        }).setOrigin(0.5).setVisible(false);

        this.infoDialog = new InfoDialog({ scene: this });
        this.confirmDialog = new ConfirmDialog({ scene: this });

        this.prevButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 50,
            backgroundTexture: 'arrow_button',
            backgroundAnimation: 'arrow_button_active',
            backgroundDisabledFrame: 8,
            onClick: () => {
                if (this.page <= 1) return;
                this.page -= 1;
                void this.loadTracks();
            },
        });

        this.nextButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 50,
            backgroundTexture: 'arrow_button',
            backgroundAnimation: 'arrow_button_active',
            backgroundDisabledFrame: 8,
            flipX: true,
            onClick: () => {
                if (!this.hasNextPage) return;
                this.page += 1;
                void this.loadTracks();
            },
        });

        this.refreshLayout();
        this.scale.on('resize', this.resizeHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.isSceneAlive = false;
            this.loadRequestId += 1;
            this.rowViews = [];
            this.scale.off('resize', this.resizeHandler);
        });
        void this.loadTracks();
    }

    private async loadTracks() {
        if (!this.isSceneAlive || !this.emptyText?.scene) return;

        const requestId = this.loadRequestId + 1;
        this.loadRequestId = requestId;
        this.destroyRows();
        this.emptyText.setVisible(false);

        try {
            const response = await RedditAPI.getUserTracks(this.page, this.limit);
            if (!this.isCurrentLoad(requestId)) return;

            this.hasNextPage = response.hasNextPage;

            if (response.tracks.length === 0 && this.page > 1) {
                this.page -= 1;
                await this.loadTracks();
                return;
            }

            if (response.tracks.length === 0) {
                this.emptyText.setVisible(true);
            } else {
                this.rowViews = response.tracks.map((track) => this.createTrackRow(track));
            }

            this.prevButton.setDisabled(this.page <= 1);
            this.nextButton.setDisabled(!this.hasNextPage);
            this.refreshLayout();
        } catch (error) {
            if (!this.isCurrentLoad(requestId)) return;
            this.infoDialog.open(error instanceof Error ? error.message : 'Failed to load records');
        }
    }

    private openInfo() {
        this.infoDialog.open(`
            Your personal collection of masterpieces! Publish your tracks to share them with the world and earn Notes.
            \nOnce published, a track is locked and cannot be deleted
        `);
    }

    private isCurrentLoad(requestId: number) {
        return this.isSceneAlive && this.loadRequestId === requestId;
    }

    private destroyRows() {
        this.rowViews.forEach((view) => {
            if (view.row.scene) view.row.destroy(true);
        });
        this.rowViews = [];
    }

    private createTrackRow(track: TrackModel): TrackRowView {
        const row = this.add.container(0, 0);
        const panel = this.add.rectangle(0, 0, 320, 112, 0x150d0a, 0.78);
        const name = this.add.text(0, 0, track.name, {
            fontSize: '20px',
            color: '#f8d66d',
            fontStyle: 'bold',
            wordWrap: { width: 180 },
        }).setOrigin(0, 0.5);
        const meta = this.add.text(0, 0, this.getTrackMeta(track), {
            fontSize: '13px',
            color: '#ffffff',
        }).setOrigin(0, 0.5);
        const status = this.add.text(0, 0, track.isPublished ? 'Published' : 'Draft', {
            fontSize: '13px',
            color: track.isPublished ? '#95ff9d' : '#ffd37a',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        const playButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 60,
            backgroundTexture: 'middle_square_button_bg',
            backgroundAnimation: 'middle_square_button_bg_active',
            backgroundDisabledFrame: 3,
            iconTexture: 'middle_square_play_icon',
            iconAnimation: 'middle_square_play_icon_active',
            onClick: () => {
                this.scene.start('PianoScene', { mode: 'playback', track, returnScene: 'UserRecordsScene' });
            },
        });

        const publishButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 50,
            backgroundTexture: 'small_square_button_bg',
            backgroundAnimation: 'small_square_button_bg_active',
            backgroundDisabledFrame: 3,
            iconTexture: 'small_square_done_icon',
            iconAnimation: 'small_square_done_icon_active',
            onClick: () => this.confirmDialog.open({
                title: 'PUBLISH RECORD?',
                message: `After publishing, this tune stays in post history, cannot be deleted, and pays a ${PUBLISH_REWARD} note reward.`,
                confirmLabel: 'Publish',
                onConfirm: async () => {
                    try {
                        const response = await RedditAPI.publishTrack({ trackId: track.id });
                        const user: UserResponse | undefined = this.registry.get('user');
                        if (user) {
                            this.registry.set('user', {
                                ...user,
                                notes: user.notes + response.bonusNotes,
                            });
                        }
                        await this.loadTracks();
                        if (this.isSceneAlive) this.infoDialog.open(`Published! You earned ${response.bonusNotes} notes.`);
                    } catch (error) {
                        if (!this.isSceneAlive) return;
                        this.infoDialog.open(error instanceof Error ? error.message : 'Publish failed');
                    }
                },
            }),
        });
        publishButton.setDisabled(track.isPublished);

        const deleteButton = new SpriteButton({
            scene: this,
            x: 0,
            y: 0,
            size: 50,
            backgroundTexture: 'small_square_button_bg',
            backgroundAnimation: 'small_square_button_bg_active',
            backgroundDisabledFrame: 3,
            iconTexture: 'small_square_remove_icon',
            iconAnimation: 'small_square_remove_icon_active',
            onClick: () => this.confirmDialog.open({
                title: 'DELETE RECORD?',
                message: 'This saved draft will disappear from your vinyl shelf.',
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    await RedditAPI.deleteTrack({ trackId: track.id });
                    await this.loadTracks();
                },
            }),
        });
        deleteButton.setDisabled(track.isPublished);

        row.add([panel, name, meta, status, playButton, publishButton, deleteButton]);

        return { row, panel, name, meta, status, playButton, publishButton, deleteButton };
    }

    private getTrackMeta(track: TrackModel) {
        const date = new Date(track.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        return [
            date,
            `Score: ${Math.round(track.averageRating)}/10`,
            `Listeners: ${track.listenerCount}`,
        ].join('\n');
    }

    private refreshLayout() {
        if (!this.isSceneAlive || !this.background?.scene) return;

        const { width, height } = this.scale;
        const rowWidth = width;
        const rowHeight = Math.max(112, Math.min(138, height * 0.17));
        const startY = height * 0.29;
        const gap = Math.max(8, height * 0.012);
        const contentX = -rowWidth / 2 + 20;
        const playButtonX = rowWidth / 2 - 100;
        const actionButtonX = rowWidth / 2 - 36;

        this.cameras.resize(width, height);
        coverSceneBackground(this.background, width, height);
        this.title.setPosition(width / 2, Math.max(52, height * 0.085));
        this.title.setFontSize(Math.max(26, Math.min(40, width * 0.07)));
        this.title.setWordWrapWidth(Math.max(170, Math.min(280, width - 150)));
        this.backButton.setPosition(42, 42);
        this.infoButton.setPosition(width - 42, 42);
        this.emptyText.setPosition(width / 2, height * 0.52);
        this.emptyText.setWordWrapWidth(width * 0.78);
        this.prevButton.setPosition(width / 2 - 38, height - 42);
        this.nextButton.setPosition(width / 2 + 38, height - 42);

        this.rowViews.forEach((view, index) => {
            if (!view.row.scene || !view.panel.scene) return;

            const rowY = startY + index * (rowHeight + gap);
            view.row.setPosition(width / 2, rowY);
            view.panel.setSize(rowWidth, rowHeight);
            view.name.setPosition(contentX, -rowHeight * 0.33);
            view.name.setWordWrapWidth(rowWidth - 188);
            view.meta.setPosition(contentX, -rowHeight * 0.03);
            view.status.setPosition(contentX, rowHeight * 0.36);
            view.playButton.setPosition(playButtonX, 0);
            view.publishButton.setPosition(actionButtonX, -26);
            view.deleteButton.setPosition(actionButtonX, 26);
        });
    }
}

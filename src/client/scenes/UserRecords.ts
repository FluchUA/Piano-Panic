import Phaser, { Scene } from 'phaser';
import { ConfirmDialog } from '../UI/ConfirmDialog';
import { InfoDialog } from '../UI/InfoDialog';
import { ToonButton } from '../UI/ToonButton';
import { RedditAPI } from '../utils/RedditAPI';
import { PUBLISH_REWARD } from '../../shared/economy';
import type { TrackModel, UserResponse } from '../../shared/api';

type TrackRowView = {
    row: Phaser.GameObjects.Container;
    panel: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.Text;
    meta: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    playButton: ToonButton;
    publishButton: ToonButton;
    deleteButton: ToonButton;
};

export class UserRecordsScene extends Scene {
    private page = 1;
    private limit = 3;
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private emptyText!: Phaser.GameObjects.Text;
    private backButton!: ToonButton;
    private prevButton!: ToonButton;
    private nextButton!: ToonButton;
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

        this.background = this.add.image(0, 0, 'background').setOrigin(0);

        this.title = this.add.text(0, 0, 'MY VINYL RECORDS', {
            fontSize: '40px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 7,
            align: 'center',
        }).setOrigin(0.5);

        this.backButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 52,
            height: 44,
            label: '<',
            fontSize: 22,
            onClick: () => {
                this.scene.start('MainMenu');
            },
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

        this.prevButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 54,
            height: 44,
            label: '<',
            fontSize: 20,
            onClick: () => {
                if (this.page <= 1) return;
                this.page -= 1;
                void this.loadTracks();
            },
        });

        this.nextButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 54,
            height: 44,
            label: '>',
            fontSize: 20,
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
        const panel = this.add.rectangle(0, 0, 320, 112, 0x201511, 0.88)
            .setStrokeStyle(3, 0xf8d66d);
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

        const playButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 42,
            height: 38,
            label: '>',
            fontSize: 18,
            onClick: () => {
                this.scene.start('PianoScene', { mode: 'playback', track, returnScene: 'UserRecordsScene' });
            },
        });

        const publishButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 42,
            height: 38,
            label: '^',
            fontSize: 18,
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

        const deleteButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 42,
            height: 38,
            label: 'X',
            fontSize: 17,
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
        });

        return `${date} | ${Math.round(track.averageRating)} avg | ${track.listenerCount} plays`;
    }

    private refreshLayout() {
        if (!this.isSceneAlive || !this.background?.scene) return;

        const { width, height } = this.scale;
        const rowWidth = Math.min(600, width * 0.9);
        const rowHeight = Math.max(92, Math.min(116, height * 0.15));
        const startY = height * 0.29;
        const gap = Math.max(8, height * 0.012);
        const contentX = -rowWidth / 2 + 18;
        const buttonX = rowWidth / 2 - 32;

        this.cameras.resize(width, height);
        this.background.setDisplaySize(width, height);
        this.title.setPosition(width / 2, Math.max(52, height * 0.085));
        this.title.setFontSize(Math.max(26, Math.min(40, width * 0.07)));
        this.title.setWordWrapWidth(Math.max(170, Math.min(280, width - 150)));
        this.backButton.setPosition(40, 40);
        this.emptyText.setPosition(width / 2, height * 0.52);
        this.emptyText.setWordWrapWidth(width * 0.78);
        this.prevButton.setPosition(width / 2 - 46, height - 42);
        this.nextButton.setPosition(width / 2 + 46, height - 42);

        this.rowViews.forEach((view, index) => {
            if (!view.row.scene || !view.panel.scene) return;

            const rowY = startY + index * (rowHeight + gap);
            view.row.setPosition(width / 2, rowY);
            view.panel.setSize(rowWidth, rowHeight);
            view.name.setPosition(contentX, -rowHeight * 0.26);
            view.name.setWordWrapWidth(rowWidth - 122);
            view.meta.setPosition(contentX, 2);
            view.status.setPosition(contentX, rowHeight * 0.26);
            view.playButton.setPosition(buttonX, -rowHeight * 0.28);
            view.publishButton.setPosition(buttonX, 0);
            view.deleteButton.setPosition(buttonX, rowHeight * 0.28);
        });
    }
}

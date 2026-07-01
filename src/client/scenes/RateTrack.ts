import Phaser, { Scene } from 'phaser';
import { InfoDialog } from '../UI/InfoDialog';
import { ToonButton } from '../UI/ToonButton';
import { RedditAPI } from '../utils/RedditAPI';
import { AppMode } from '../../shared/api';
import { formatNotes, getPrestigeTitle } from '../../shared/economy';
import type { PostInfoResponse, TrackModel } from '../../shared/api';

export class RateTrackScene extends Scene {
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private authorIntroText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;
    private helperText!: Phaser.GameObjects.Text;
    private backButton?: ToonButton;
    private listenButton!: ToonButton;
    private ratingButtons: ToonButton[] = [];
    private dialog!: InfoDialog;
    private track!: TrackModel;
    private isAuthor = false;
    private hasListened = false;
    private userVote: number | null = null;
    private listenerCount = 0;
    private averageRating = 0;
    private ratingCount = 0;
    private authorName = 'Unknown Maestro';
    private authorNotes = 0;
    private resizeHandler = () => this.refreshLayout();

    constructor() {
        super('RateTrackScene');
    }

    create() {
        const post: PostInfoResponse | undefined = this.registry.get('post');
        if (!post || post.mode === AppMode.HUB) {
            this.scene.start('MainMenu');
            return;
        }

        this.track = post.riddleData.track;
        this.isAuthor = post.riddleData.isAuthor;
        this.hasListened = post.riddleData.hasListened;
        this.userVote = post.riddleData.userVote;
        this.listenerCount = post.riddleData.listenerCount;
        this.averageRating = post.riddleData.averageRating;
        this.ratingCount = post.riddleData.ratingCount;
        this.authorName = post.riddleData.authorName;
        this.authorNotes = post.riddleData.authorNotes;

        this.background = this.add.image(0, 0, 'background').setOrigin(0);
        this.dialog = new InfoDialog({ scene: this });

        this.title = this.add.text(0, 0, this.isAuthor ? 'YOUR SMASH HIT!' : 'RATE THAT TOON!', {
            fontSize: '42px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5);

        this.subtitle = this.add.text(0, 0, this.track.name, {
            fontSize: '24px',
            color: '#fff4c2',
            stroke: '#2f2118',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: 560 },
        }).setOrigin(0.5);

        this.authorIntroText = this.add.text(0, 0, this.getAuthorIntroText(), {
            fontSize: '18px',
            color: '#fff4c2',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: 520 },
        }).setOrigin(0.5).setVisible(!this.isAuthor);

        this.statsText = this.add.text(0, 0, '', {
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#2f2118',
            strokeThickness: 4,
            align: 'center',
        }).setOrigin(0.5);

        this.helperText = this.add.text(0, 0, '', {
            fontSize: '18px',
            color: '#fff4c2',
            stroke: '#2f2118',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: 520 },
        }).setOrigin(0.5);

        this.listenButton = new ToonButton({
            scene: this,
            x: 0,
            y: 0,
            width: 220,
            height: 56,
            label: this.isAuthor ? 'LISTEN AGAIN' : 'LISTEN',
            onClick: () => this.listen(),
        });

        if (!this.isAuthor) this.createRatingButtons();

        this.updateStatsText();
        this.updateRatingButtons();
        this.refreshLayout();
        this.scale.on('resize', this.resizeHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.resizeHandler);
        });
    }

    private createRatingButtons() {
        for (let rating = 1; rating <= 10; rating += 1) {
            const button = new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 76,
                height: 52,
                label: String(rating),
                fontSize: 20,
                onClick: () => this.submitRating(rating),
            });
            this.ratingButtons.push(button);
        }
    }

    private async listen() {
        if (!this.isAuthor && !this.hasListened) {
            const response = await RedditAPI.listenTrack({ trackId: this.track.id });
            this.hasListened = response.hasListened;
            this.listenerCount = response.listenerCount;
            this.syncPostRegistry();
            this.updateStatsText();
            this.updateRatingButtons();
        }

        this.scene.start('PianoScene', {
            mode: 'playback',
            track: this.track,
            returnScene: 'RateTrackScene',
        });
    }

    private async submitRating(rating: number) {
        if (!this.hasListened || this.userVote !== null) return;

        try {
            const response = await RedditAPI.rateTrack({ trackId: this.track.id, rating });
            this.userVote = response.rating;
            this.averageRating = response.averageRating;
            this.ratingCount = response.ratingCount;
            this.syncPostRegistry();
            this.updateStatsText();
            this.updateRatingButtons();
            this.dialog.open(`Thanks, Maestro! You earned ${response.reward} notes.`);
        } catch (error) {
            this.dialog.open(error instanceof Error ? error.message : 'Rating failed');
        }
    }

    private updateStatsText() {
        this.statsText.setText([
            `Total Listeners: ${this.listenerCount}`,
            `Average Rating: ${Math.round(this.averageRating)}`,
        ].join('\n'));

        if (this.isAuthor) {
            this.helperText.setText('Your tune is live. Give it another spin any time.');
            return;
        }

        if (this.userVote !== null) {
            this.helperText.setText(`Your rating: ${this.userVote}`);
            return;
        }

        this.helperText.setText(this.hasListened ? 'Pick your score!' : 'Shhh... Quiet on set! Listen first!');
    }

    private getAuthorIntroText() {
        return [
            `${getPrestigeTitle(this.authorNotes)} - ${this.authorName}`,
            `Wealth: ${formatNotes(this.authorNotes)} Golden Notes`,
        ].join('\n');
    }

    private updateRatingButtons() {
        this.ratingButtons.forEach((button, index) => {
            const rating = index + 1;
            button.setDisabled(!this.hasListened || this.userVote !== null);
            button.setLabel(this.userVote === rating ? `${rating} *` : String(rating));
        });
    }

    private syncPostRegistry() {
        const post: PostInfoResponse | undefined = this.registry.get('post');
        if (!post || post.mode !== AppMode.RATE) return;

        this.registry.set('post', {
            mode: AppMode.RATE,
            riddleData: {
                ...post.riddleData,
                listenerCount: this.listenerCount,
                hasListened: this.hasListened,
                userVote: this.userVote,
                averageRating: this.averageRating,
                ratingCount: this.ratingCount,
                track: {
                    ...post.riddleData.track,
                    listenerCount: this.listenerCount,
                    averageRating: this.averageRating,
                    ratingCount: this.ratingCount,
                },
            },
        });
    }

    private refreshLayout() {
        const { width, height } = this.scale;
        const gridCols = 5;
        const gap = Math.max(10, Math.min(18, width * 0.018));
        const startX = width / 2 - ((gridCols - 1) * (76 + gap)) / 2;
        const startY = height * 0.37;

        this.cameras.resize(width, height);
        this.background.setDisplaySize(width, height);
        this.backButton?.setPosition(76, 44);
        this.title.setPosition(width / 2, Math.max(52, height * 0.09));
        this.title.setWordWrapWidth(Math.max(180, Math.min(300, width * 0.72)));
        this.authorIntroText.setVisible(!this.isAuthor);
        this.authorIntroText.setPosition(width / 2, height * 0.22);
        this.authorIntroText.setWordWrapWidth(width * 0.78);
        this.subtitle.setPosition(width / 2, this.isAuthor ? height * 0.23 : height * 0.32);
        this.subtitle.setWordWrapWidth(width * 0.76);
        this.statsText.setPosition(width / 2, this.isAuthor ? height * 0.42 : height * 0.68);
        this.helperText.setPosition(width / 2, this.isAuthor ? height * 0.56 : height * 0.79);
        this.helperText.setWordWrapWidth(width * 0.76);
        this.listenButton.setPosition(width / 2, this.isAuthor ? height * 0.74 : height * 0.9);

        this.ratingButtons.forEach((button, index) => {
            const row = Math.floor(index / gridCols);
            const col = index % gridCols;
            button.setPosition(startX + col * (76 + gap), startY + row * 66);
        });
    }
}

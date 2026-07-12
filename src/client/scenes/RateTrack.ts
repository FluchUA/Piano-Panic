import Phaser, { Scene } from 'phaser';
import { InfoDialog } from '../UI/InfoDialog';
import { SpriteButton } from '../UI/SpriteButton';
import { TextSpriteButton } from '../UI/TextSpriteButton';
import { RedditAPI } from '../utils/RedditAPI';
import { AppMode } from '../../shared/api';
import { formatNotes, getPrestigeTitle } from '../../shared/economy';
import { coverSceneBackground } from '../utils/sceneBackground';
import type { PostInfoResponse, TrackModel } from '../../shared/api';

export class RateTrackScene extends Scene {
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private authorIntroText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;
    private helperText!: Phaser.GameObjects.Text;
    private infoButton!: SpriteButton;
    private listenButton!: TextSpriteButton;
    private ratingButtons: SpriteButton[] = [];
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
        this.ratingButtons = [];
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

        this.title = this.add.text(0, 0, this.isAuthor ? 'YOUR\nSMASH HIT!' : 'RATE THAT TOON!', {
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
            fontStyle: 'bold',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: 560 },
        }).setOrigin(0.5);

        this.authorIntroText = this.add.text(0, 0, this.getAuthorIntroText(), {
            fontSize: '18px',
            color: '#fff4c2',
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

        this.listenButton = new TextSpriteButton({
            scene: this,
            x: 0,
            y: 0,
            width: 336,
            height: 54,
            backgroundTexture: 'middle_text_button_bg',
            backgroundAnimation: 'middle_text_button_bg_active',
            contentTexture: this.isAuthor ? 'middle_text_button_listen_again' : 'middle_text_button_listen',
            contentAnimation: this.isAuthor ? 'middle_text_button_listen_again_active' : 'middle_text_button_listen_active',
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
            const button = new SpriteButton({
                scene: this,
                x: 0,
                y: 0,
                size: 60,
                backgroundTexture: 'middle_square_button_bg',
                backgroundAnimation: 'middle_square_button_bg_active',
                backgroundDisabledFrame: 3,
                text: String(rating),
                fontSize: 30,
                onClick: () => this.submitRating(rating),
            });
            this.ratingButtons.push(button);
        }
    }

    private openInfo() {
        this.dialog.open(this.isAuthor ? 'Your masterpiece is out in the wild! Check this space anytime to see your total listener count and track your current average score' 
            : 'Time to be the judge! Listen closely to the track first, then rate it from 1 to 10. Every unique rating pockets you Notes to spend at The music emporium!');
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
            this.dialog.open(`Thanks, Maestro! You earned ${response.reward} notes`);
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
            `Wealth: ${formatNotes(this.authorNotes)} Notes`,
        ].join('\n');
    }

    private updateRatingButtons() {
        this.ratingButtons.forEach((button, index) => {
            const rating = index + 1;
            const isSelectedVote = this.userVote === rating;
            button.setDisabled(!this.hasListened || this.userVote !== null, !isSelectedVote);
            button.setText(String(rating));
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
        const ratingButtonSize = 60;
        const startX = width / 2 - ((gridCols - 1) * (ratingButtonSize + gap)) / 2;
        const startY = height * 0.45;
        const titleY = Math.max(58, height * 0.14);
        const listenY = height - Math.max(88, height * 0.14);

        this.cameras.resize(width, height);
        coverSceneBackground(this.background, width, height);
        this.infoButton.setPosition(width - 42, 42);
        this.title.setPosition(width / 2, titleY);
        this.title.setWordWrapWidth(Math.max(180, Math.min(300, width * 0.72)));
        this.authorIntroText.setVisible(!this.isAuthor);
        this.authorIntroText.setPosition(width / 2, height * 0.26);
        this.authorIntroText.setWordWrapWidth(width * 0.78);
        this.subtitle.setPosition(width / 2, this.isAuthor ? height * 0.35 : height * 0.34);
        this.subtitle.setWordWrapWidth(width * 0.76);
        this.statsText.setPosition(width / 2, this.isAuthor ? height * 0.5 : height * 0.72);
        this.helperText.setPosition(width / 2, height * 0.94);
        this.helperText.setWordWrapWidth(width * 0.76);
        this.listenButton.resize(Math.min(336, width * 0.74), 54);
        this.listenButton.setPosition(width / 2, listenY);

        this.ratingButtons.forEach((button, index) => {
            const row = Math.floor(index / gridCols);
            const col = index % gridCols;
            button.setPosition(startX + col * (ratingButtonSize + gap), startY + row * 66);
        });
    }
}

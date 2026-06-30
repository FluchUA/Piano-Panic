import Phaser, { Scene } from 'phaser';
import { CurrencyWidget } from '../UI/CurrencyWidget';
import { ToonButton } from '../UI/ToonButton';
import { ConfirmDialog } from '../UI/ConfirmDialog';
import { InfoDialog } from '../UI/InfoDialog';
import { RedditAPI } from '../utils/RedditAPI';
import { ShopItem } from '../../shared/api';
import type { UserResponse } from '../../shared/api';

type ShopEntry = {
    id: ShopItem;
    title: string;
    price: number;
};

type ShopItemView = {
    container: Phaser.GameObjects.Container;
    panel: Phaser.GameObjects.Rectangle;
    artPlaceholder: Phaser.GameObjects.Rectangle;
    title: Phaser.GameObjects.Text;
    button: ToonButton;
};

const SHOP_ITEMS: ShopEntry[] = [
    { id: ShopItem.TIME_PLUS_5, title: '+5 SEC', price: 1 },
    { id: ShopItem.SYNTH_PIANO, title: 'SYNTH', price: 1 },
    { id: ShopItem.ORGAN, title: 'ORGAN', price: 1 },
    { id: ShopItem.RETRO, title: 'RETRO', price: 1 },
    { id: ShopItem.ELECTRO, title: 'ELECTRO', price: 1 },
];

export class ShopScene extends Scene {
    private background!: Phaser.GameObjects.Image;
    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private backButton!: ToonButton;
    private currency!: CurrencyWidget;
    private itemViews: ShopItemView[] = [];
    private debugButtons: ToonButton[] = [];
    private infoDialog!: InfoDialog;
    private confirmDialog!: ConfirmDialog;
    private user!: UserResponse;
    private resizeHandler = () => this.refreshLayout();

    constructor() {
        super('ShopScene');
    }

    create() {
        const registryUser: UserResponse | undefined = this.registry.get('user');
        this.user = registryUser ?? {
            id: '',
            name: 'Anonymous Whistler',
            notes: 0,
            purchasedItems: [],
            maxTrackDuration: 30,
        };

        this.background = this.add.image(0, 0, 'background').setOrigin(0);
        this.title = this.add.text(0, 0, 'THE MUSIC EMPORIUM', {
            fontSize: '40px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#2f2118',
            strokeThickness: 7,
            align: 'center',
        }).setOrigin(0.5);
        this.subtitle = this.add.text(0, 0, "Whatcha buyin', pal?", {
            fontSize: '20px',
            color: '#fff4c2',
            stroke: '#2f2118',
            strokeThickness: 4,
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

        this.currency = new CurrencyWidget({ scene: this, x: 0, y: 0 });
        this.currency.setValue(this.user.notes);
        this.infoDialog = new InfoDialog({ scene: this });
        this.confirmDialog = new ConfirmDialog({ scene: this });

        this.renderItems();
        this.renderDebugButtons();
        this.refreshLayout();
        this.scale.on('resize', this.resizeHandler);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.resizeHandler);
        });
    }

    private renderItems() {
        this.itemViews.forEach((view) => view.container.destroy(true));
        this.itemViews = SHOP_ITEMS.map((item) => this.createItemView(item));
    }

    private createItemView(item: ShopEntry): ShopItemView {
        const container = this.add.container(0, 0);
        const panel = this.add.rectangle(0, 0, 140, 150, 0x201511, 0.88)
            .setStrokeStyle(3, 0xf8d66d);
        const title = this.add.text(0, -54, item.title, {
            fontSize: '16px',
            color: '#f8d66d',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);
        const artPlaceholder = this.add.rectangle(0, -8, 72, 54, 0x32231c, 1)
            .setStrokeStyle(2, 0xffffff);
        const button = new ToonButton({
            scene: this,
            x: 0,
            y: 52,
            width: 96,
            height: 38,
            label: this.getItemButtonLabel(item),
            fontSize: 13,
            onClick: () => this.buyItem(item),
        });

        button.setDisabled(this.isItemOwned(item));
        container.add([panel, title, artPlaceholder, button]);

        return { container, panel, artPlaceholder, title, button };
    }

    private renderDebugButtons() {
        this.debugButtons.forEach((button) => button.destroy());
        this.debugButtons = [
            new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 46,
                height: 38,
                label: '+',
                fontSize: 20,
                onClick: () => this.debugAddNotes(),
            }),
            new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 46,
                height: 38,
                label: '-',
                fontSize: 20,
                onClick: () => this.debugRemoveNotes(),
            }),
            new ToonButton({
                scene: this,
                x: 0,
                y: 0,
                width: 76,
                height: 38,
                label: 'RST',
                fontSize: 14,
                onClick: () => this.confirmDialog.open({
                    title: 'RESET SHOP?',
                    message: 'This clears purchased instruments and bonus time for testing.',
                    confirmLabel: 'Reset',
                    onConfirm: () => this.debugResetShop(),
                }),
            }),
        ];
    }

    private async buyItem(item: ShopEntry) {
        try {
            const response = await RedditAPI.buyItem(item.id);
            this.user = {
                ...this.user,
                notes: response.updatedNotes,
                purchasedItems: response.purchasedItems ?? this.user.purchasedItems,
                maxTrackDuration: response.updatedDuration ?? this.user.maxTrackDuration,
            };
            this.registry.set('user', this.user);
            this.currency.setValue(this.user.notes);
            this.renderItems();
            this.refreshLayout();
        } catch (error) {
            this.infoDialog.open(error instanceof Error ? error.message : 'Purchase failed');
        }
    }

    private async debugAddNotes() {
        const response = await RedditAPI.debugAddNotes();
        this.user = { ...this.user, notes: response.notes };
        this.registry.set('user', this.user);
        this.currency.setValue(response.notes);
    }

    private async debugRemoveNotes() {
        const response = await RedditAPI.debugRemoveNotes();
        this.user = { ...this.user, notes: response.notes };
        this.registry.set('user', this.user);
        this.currency.setValue(response.notes);
    }

    private async debugResetShop() {
        const response = await RedditAPI.debugResetShop();
        this.user = {
            ...this.user,
            notes: response.notes,
            purchasedItems: response.purchasedItems,
            maxTrackDuration: response.maxTrackDuration,
        };
        this.registry.set('user', this.user);
        this.currency.setValue(response.notes);
        this.renderItems();
        this.refreshLayout();
    }

    private getItemButtonLabel(item: ShopEntry) {
        return this.isItemOwned(item) ? 'SOLD' : `${item.price} NOTE`;
    }

    private isItemOwned(item: ShopEntry) {
        if (item.id === ShopItem.TIME_PLUS_5) {
            return this.user.maxTrackDuration >= 300;
        }

        return this.user.purchasedItems.includes(item.id);
    }

    private refreshLayout() {
        const { width, height } = this.scale;
        const columns = 3;
        const cardWidth = Math.min(132, (width * 0.9 - 16) / columns);
        const cardHeight = Math.max(108, Math.min(138, height * 0.17));
        const gapX = Math.min(12, width * 0.025);
        const gapY = Math.max(12, height * 0.02);
        const leftSafe = 82;
        const rightSafe = 154;
        const titleWidth = Math.max(150, width - leftSafe - rightSafe);
        const titleWrapWidth = Math.min(300, titleWidth);
        const titleX = leftSafe + titleWidth / 2;
        const startY = height * 0.34;

        this.cameras.resize(width, height);
        this.background.setDisplaySize(width, height);
        this.backButton.setPosition(40, 40);
        this.currency.setPosition(width - 112, 40);
        this.title.setPosition(titleX, Math.max(50, height * 0.08));
        this.title.setFontSize(Math.max(25, Math.min(40, width * 0.065)));
        this.title.setWordWrapWidth(titleWrapWidth);
        this.subtitle.setPosition(width / 2, height * 0.19);

        this.itemViews.forEach((view, index) => {
            const row = Math.floor(index / columns);
            const col = index - row * columns;
            const itemsInRow = Math.min(columns, this.itemViews.length - row * columns);
            const rowWidth = itemsInRow * cardWidth + (itemsInRow - 1) * gapX;
            const rowStartX = width / 2 - rowWidth / 2 + cardWidth / 2;
            const x = rowStartX + col * (cardWidth + gapX);
            const y = startY + row * (cardHeight + gapY);

            view.container.setPosition(x, y);
            view.panel.setSize(cardWidth, cardHeight);
            view.title.setPosition(0, -cardHeight * 0.34);
            view.title.setFontSize(Math.max(12, Math.min(16, cardWidth * 0.13)));
            view.artPlaceholder.setPosition(0, -cardHeight * 0.03);
            view.artPlaceholder.setSize(cardWidth * 0.56, cardHeight * 0.34);
            view.button.resize(cardWidth * 0.72, Math.max(32, cardHeight * 0.25), 12);
            view.button.setPosition(0, cardHeight * 0.32);
        });

        const debugY = height - 34;
        this.debugButtons[0]?.setPosition(width / 2 - 72, debugY);
        this.debugButtons[1]?.setPosition(width / 2 - 18, debugY);
        this.debugButtons[2]?.setPosition(width / 2 + 54, debugY);
    }
}

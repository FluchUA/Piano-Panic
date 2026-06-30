import Phaser, { Scene } from 'phaser';

import { CurrencyWidget } from '../UI/CurrencyWidget';
import { ToonButton } from '../UI/ToonButton';
import type { UserResponse } from '../../shared/api';

export class MainMenu extends Scene {
  private background!: Phaser.GameObjects.Image;
  private titleMain!: Phaser.GameObjects.Text;
  private titleSub!: Phaser.GameObjects.Text;

  private btnCompose!: ToonButton;
  private btnRecords!: ToonButton;
  private btnShop!: ToonButton;

  private currency!: CurrencyWidget;
  private resizeHandler = () => this.refreshLayout();

  constructor() {
    super('MainMenu');
  }

  create() {
    const user: UserResponse | undefined = this.registry.get('user');

    this.background = this.add.image(0, 0, 'background').setOrigin(0);
    this.background.setDepth(0);

    this.titleMain = this.add.text(0, 0, 'TOONTUNE STUDIO', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#2f2118',
      strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5);

    this.titleSub = this.add.text(0, 0, 'Welcome, Maestro!', {
      fontSize: '22px',
      color: '#fff4c2',
      stroke: '#2f2118',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.btnCompose = new ToonButton({
      scene: this,
      x: 0,
      y: 0,
      width: 320,
      height: 62,
      label: 'COMPOSE A TUNE',
      onClick: () => {
        this.scene.start('PianoScene', { mode: 'compose' });
      },
    });

    this.btnRecords = new ToonButton({
      scene: this,
      x: 0,
      y: 0,
      width: 320,
      height: 62,
      label: 'MY VINYL RECORDS',
      onClick: () => {
        this.scene.start('UserRecordsScene');
      },
    });

    this.btnShop = new ToonButton({
      scene: this,
      x: 0,
      y: 0,
      width: 320,
      height: 62,
      label: 'THE MUSIC EMPORIUM',
      onClick: () => {
        this.scene.start('ShopScene');
      },
    });

    this.currency = new CurrencyWidget({
      scene: this,
      x: 0,
      y: 0,
    });
    this.currency.setValue(user?.notes ?? 0);

    this.refreshLayout();
    this.scale.on('resize', this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.resizeHandler);
    });
  }

  private refreshLayout() {
    const { width, height } = this.scale;
    const buttonWidth = Math.min(340, width * 0.76);
    const buttonHeight = Math.max(52, Math.min(66, height * 0.085));

    this.cameras.resize(width, height);
    this.background.setDisplaySize(width, height);

    this.titleMain.setPosition(width / 2, height * 0.14);
    this.titleMain.setFontSize(Math.max(30, Math.min(48, width * 0.055)));
    this.titleMain.setWordWrapWidth(Math.max(190, Math.min(300, width * 0.64)));
    this.titleSub.setPosition(width / 2, height * 0.24);

    this.btnCompose.resize(buttonWidth, buttonHeight, 20);
    this.btnRecords.resize(buttonWidth, buttonHeight, 20);
    this.btnShop.resize(buttonWidth, buttonHeight, 20);

    this.btnCompose.setPosition(width / 2, height * 0.43);
    this.btnRecords.setPosition(width / 2, height * 0.56);
    this.btnShop.setPosition(width / 2, height * 0.69);

    this.currency.setPosition(width - 112, 40);
  }
}

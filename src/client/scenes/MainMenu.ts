import { Scene } from 'phaser';

import { AnimatedButton } from '../UI/AnimatedButton';
import { CurrencyWidget } from '../UI/CurrencyWidget';

export class MainMenu extends Scene {
  private titleMain!: Phaser.GameObjects.Text;
  private titleSub!: Phaser.GameObjects.Text;

  private btnCompose!: AnimatedButton;
  private btnRecords!: AnimatedButton;
  private btnShop!: AnimatedButton;

  private currency!: CurrencyWidget;

  constructor() {
    super('MainMenu');
  }

  create() {
    // BACKGROUND
    const bg = this.add.image(0, 0, 'background').setOrigin(0);
    bg.setDepth(0);

    // ===== TITLE =====
    this.titleMain = this.add.text(0, 0, 'TOONTUNE STUDIO', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.titleSub = this.add.text(0, 0, 'Welcome, Maestro!', {
      fontSize: '22px',
      color: '#cccccc'
    }).setOrigin(0.5);

    // ===== BUTTONS =====
    this.btnCompose = new AnimatedButton({
      scene: this,
      x: 0,
      y: 0,
      texture: 'main_button',
      animationKey: 'btn_idle',
      onClick: () => this.scene.start('PianoScene')
    });

    this.btnRecords = new AnimatedButton({
      scene: this,
      x: 0,
      y: 0,
      texture: 'main_button',
      animationKey: 'btn_idle',
      onClick: () => this.scene.start('UserRecordsScene')
    });

    this.btnShop = new AnimatedButton({
      scene: this,
      x: 0,
      y: 0,
      texture: 'main_button',
      animationKey: 'btn_idle',
      onClick: () => this.scene.start('ShopScene')
    });

    // ===== CURRENCY (top-right widget) =====
    this.currency = new CurrencyWidget({
      scene: this,
      x: 0,
      y: 0
    });

    this.currency.setValue(1250);

    // ===== LAYOUT =====
    this.refreshLayout();

    // RESPONSIVE RESIZE
    this.scale.on('resize', () => {
      this.refreshLayout();
    });
  }

  private refreshLayout() {
    const { width, height } = this.scale;

    this.cameras.resize(width, height);

    // BACKGROUND
    const bg = this.children.getAll()[0] as Phaser.GameObjects.Image;
    bg.setDisplaySize(width, height);

    // ===== TITLE =====
    this.titleMain.setPosition(width / 2, height * 0.18);
    this.titleSub.setPosition(width / 2, height * 0.26);

    // ===== BUTTON STACK =====
    const centerX = width / 2;

    this.btnCompose.setPosition(centerX, height * 0.45);
    this.btnRecords.setPosition(centerX, height * 0.58);
    this.btnShop.setPosition(centerX, height * 0.71);

    // ===== CURRENCY (fixed top-right) =====
    this.currency.setPosition(width - 110, 40);
  }
}
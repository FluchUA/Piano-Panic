import Phaser, { Scene } from 'phaser';

import { CurrencyWidget } from '../UI/CurrencyWidget';
import { InfoDialog } from '../UI/InfoDialog';
import { TextSpriteButton } from '../UI/TextSpriteButton';
import { getPrestigeTitle } from '../../shared/economy';
import { coverSceneBackground } from '../utils/sceneBackground';
import type { UserResponse } from '../../shared/api';

export class MainMenu extends Scene {
  private background!: Phaser.GameObjects.Image;
  private titleMain!: Phaser.GameObjects.Text;
  private titleSub!: Phaser.GameObjects.Text;
  private prestigeText!: Phaser.GameObjects.Text;

  private btnCompose!: TextSpriteButton;
  private btnRecords!: TextSpriteButton;
  private btnShop!: TextSpriteButton;

  private currency!: CurrencyWidget;
  private infoDialog!: InfoDialog;
  private prestigePulse: Phaser.Tweens.Tween | undefined;
  private resizeHandler = () => this.refreshLayout();

  constructor() {
    super('MainMenu');
  }

  // Builds the main menu screen
  create() {
    const user: UserResponse | undefined = this.registry.get('user');

    this.background = this.add.image(0, 0, 'background').setOrigin(0);
    this.background.setDepth(0);

    this.titleMain = this.add.text(0, 0, 'TOONTUNE\nSTUDIO', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#2f2118',
      strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5);

    this.titleSub = this.add.text(0, 0, `Welcome, ${user?.name ?? 'Maestro'}!`, {
      fontSize: '22px',
      color: '#fff4c2',
      stroke: '#2f2118',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.prestigeText = this.add.text(0, 0, `Prestige: ${getPrestigeTitle(user?.notes ?? 0)}`, {
      fontSize: '20px',
      color: '#f8d66d',
      fontStyle: 'bold',
      stroke: '#2f2118',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.prestigeText.setInteractive({ useHandCursor: true });
    this.prestigeText.on('pointerout', () => this.prestigeText.setAlpha(1));
    this.prestigeText.on('pointerdown', () => this.prestigeText.setAlpha(0.78));
    this.prestigeText.on('pointerup', () => {
      this.prestigeText.setAlpha(1);
      this.openPrestigeInfo();
    });
    this.prestigePulse = this.tweens.add({
      targets: this.prestigeText,
      scaleX: 1.07,
      scaleY: 1.07,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.btnCompose = new TextSpriteButton({
      scene: this,
      x: 0,
      y: 0,
      width: 320,
      height: 54,
      backgroundTexture: 'middle_text_button_bg',
      backgroundAnimation: 'middle_text_button_bg_active',
      contentTexture: 'middle_text_button_compose',
      contentAnimation: 'middle_text_button_compose_active',
      onClick: () => {
        this.scene.start('PianoScene', { mode: 'compose' });
      },
    });

    this.btnRecords = new TextSpriteButton({
      scene: this,
      x: 0,
      y: 0,
      width: 320,
      height: 54,
      backgroundTexture: 'middle_text_button_bg',
      backgroundAnimation: 'middle_text_button_bg_active',
      contentTexture: 'middle_text_button_records',
      contentAnimation: 'middle_text_button_records_active',
      onClick: () => {
        this.scene.start('UserRecordsScene');
      },
    });

    this.btnShop = new TextSpriteButton({
      scene: this,
      x: 0,
      y: 0,
      width: 320,
      height: 54,
      backgroundTexture: 'middle_text_button_bg',
      backgroundAnimation: 'middle_text_button_bg_active',
      contentTexture: 'middle_text_button_emporium',
      contentAnimation: 'middle_text_button_emporium_active',
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
    this.infoDialog = new InfoDialog({ scene: this });

    this.refreshLayout();
    this.scale.on('resize', this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.prestigePulse?.remove();
      this.scale.off('resize', this.resizeHandler);
    });
  }

  // Shows the prestige rank explanation
  private openPrestigeInfo() {
    this.infoDialog.open(`
      Earn Notes by creating and rating tunes to climb the musical ladder!
      \nWhistler, Street Busker (100+), Jazz Cat (500+), Virtuoso (1500+), Grand Maestro (3000+)
    `);
  }

  // Repositions the menu for the current screen size
  private refreshLayout() {
    const { width, height } = this.scale;
    const buttonWidth = Math.min(340, width * 0.76);
    const buttonHeight = Math.max(48, Math.min(58, height * 0.078));

    this.cameras.resize(width, height);
    coverSceneBackground(this.background, width, height);

    this.titleMain.setPosition(width / 2, height * 0.2);
    this.titleMain.setFontSize(Math.max(30, Math.min(48, width * 0.055)));
    this.titleMain.setWordWrapWidth(Math.max(190, Math.min(300, width * 0.64)));
    this.titleSub.setPosition(width / 2, height * 0.32);
    this.titleSub.setWordWrapWidth(width * 0.78);
    this.prestigeText.setPosition(width / 2, height * 0.38);
    this.prestigeText.setWordWrapWidth(width * 0.78);

    this.btnCompose.resize(buttonWidth, buttonHeight, 20);
    this.btnRecords.resize(buttonWidth, buttonHeight, 20);
    this.btnShop.resize(buttonWidth, buttonHeight, 20);

    const buttonGap = Math.max(7, Math.min(14, height * 0.016));
    const buttonStep = buttonHeight + buttonGap;
    const buttonGroupY = height * 0.7;

    this.btnCompose.setPosition(width / 2, buttonGroupY - buttonStep);
    this.btnRecords.setPosition(width / 2, buttonGroupY);
    this.btnShop.setPosition(width / 2, buttonGroupY + buttonStep);

    this.currency.setResponsiveScale(width);
    this.currency.setPosition(width - 48, 40);
  }
}

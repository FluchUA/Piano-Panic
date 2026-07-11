import Phaser, { Scene } from 'phaser';

type CurrencyConfig = {
  scene: Scene;
  x: number;
  y: number;
};

export class CurrencyWidget {
  private container: Phaser.GameObjects.Container;
  private icon: Phaser.GameObjects.Sprite;
  private text: Phaser.GameObjects.Text;

  private value = 0;
  private responsiveScale = 1;

  constructor(cfg: CurrencyConfig) {
    const { scene } = cfg;

    this.icon = scene.add.sprite(0, 0, 'currency');
    this.icon.play('currency_spin');

    this.text = scene.add.text(0, 0, '0', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#2f2118',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5);

    this.container = scene.add.container(cfg.x, cfg.y, [
      this.icon,
      this.text
    ]);

    this.container.setScrollFactor(0); // fixed UI
  }

  setValue(v: number) {
    this.value = v;
    this.text.setText(v.toLocaleString('en-US'));
    this.fitTextInsideIcon();
  }

  setResponsiveScale(screenWidth: number) {
    this.responsiveScale = screenWidth >= 480 ? 1 : Math.max(0.72, screenWidth / 480);
    this.fitTextInsideIcon();
  }

  add(v: number) {
    this.setValue(this.value + v);
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  private fitTextInsideIcon() {
    this.text.setScale(1);

    const maxTextWidth = Math.max(1, this.icon.width - 14);
    const maxTextHeight = Math.max(1, this.icon.height - 18);
    const widthScale = maxTextWidth / Math.max(1, this.text.width);
    const heightScale = maxTextHeight / Math.max(1, this.text.height);
    const scale = Math.min(this.responsiveScale, widthScale, heightScale, 1);

    this.text.setScale(scale);
  }
}

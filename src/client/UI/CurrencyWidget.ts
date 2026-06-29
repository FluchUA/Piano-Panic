import { Scene } from 'phaser';

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

  constructor(cfg: CurrencyConfig) {
    const { scene } = cfg;

    this.icon = scene.add.sprite(0, 0, 'coin');
    this.icon.play('coin_spin');

    this.text = scene.add.text(30, -10, '0', {
      fontSize: '20px',
      color: '#ffffff'
    });

    this.container = scene.add.container(cfg.x, cfg.y, [
      this.icon,
      this.text
    ]);

    this.container.setScrollFactor(0); // fixed UI
  }

  setValue(v: number) {
    this.value = v;
    this.text.setText(String(v));
  }

  add(v: number) {
    this.setValue(this.value + v);
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }
}
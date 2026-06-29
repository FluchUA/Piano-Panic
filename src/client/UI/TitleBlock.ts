import { Scene } from 'phaser';

type TitleConfig = {
  scene: Scene;
  x: number;
  y: number;
  mainText: string;
  subText: string;
};

export class TitleBlock {
  private main: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;

  constructor(cfg: TitleConfig) {
    const { scene } = cfg;

    this.main = scene.add.text(cfg.x, cfg.y, cfg.mainText, {
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.sub = scene.add.text(cfg.x, cfg.y + 50, cfg.subText, {
      fontSize: '22px',
      color: '#cccccc'
    }).setOrigin(0.5);
  }
}
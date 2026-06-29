import { Scene } from 'phaser';
import { PostInfoResponse } from '../../shared/api';
import { AppMode } from '../../shared/api';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    //  We loaded this image in our Boot Scene, so we can display it here
    this.add.image(512, 384, 'background');

    //  A simple progress bar. This is the outline of the bar.
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

    //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
    const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

    //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
    this.load.on('progress', (progress: number) => {
      //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
    //  Load the assets for the game - Replace with your own assets
    this.load.setPath('../assets');
    this.load.spritesheet(
      'button_test',
      'button_test.png',
      {
        frameWidth: 100,
        frameHeight: 100
      }
    );


    this.load.image('logo', 'logo.png');
  }

  create() {
    this.anims.create({
      key: "button_test_key",
      frames: this.anims.generateFrameNumbers("button_test", {
        start: 0,
        end: 2
      }),
      frameRate: 6,
      repeat: -1,
      yoyo: true,
    });

    const post = this.registry.get('post') as PostInfoResponse;
    if (post) {
      if (post.mode === AppMode.HUB) {
        this.scene.start('RateTrackScene');
      } else {
        this.scene.start('RateTrackScene');
      }
    }
  }
}

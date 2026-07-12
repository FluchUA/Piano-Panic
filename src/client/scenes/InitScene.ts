import { Scene } from 'phaser';
import { RedditAPI } from '../utils/RedditAPI';

export class InitScene extends Scene {
    constructor() {
        super('InitScene');
    }

    // Loads user and post state before assets
    async create() {
        try {
            const [user, post] = await Promise.all([
                RedditAPI.getUser(),
                RedditAPI.getPostInfo()
            ]);

            this.registry.set('user', user);
            this.registry.set('post', post);

            this.scene.start('Preloader');
        } catch (e) {
            console.error(e);
        }
    }
}

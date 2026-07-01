import { ShopItem } from './api';

export const RATING_REWARD = 5;
export const PUBLISH_REWARD = 30;

export const SHOP_ITEM_PRICES: Record<ShopItem, number> = {
    [ShopItem.TIME_PLUS_5]: 60,
    [ShopItem.RETRO]: 150,
    [ShopItem.ELECTRO]: 300,
    [ShopItem.SYNTH_PIANO]: 500,
    [ShopItem.ORGAN]: 900,
};

export const getPrestigeTitle = (notes: number) => {
    if (notes >= 3001) return 'Grand Maestro';
    if (notes >= 1501) return 'Virtuoso';
    if (notes >= 501) return 'Jazz Cat';
    if (notes >= 101) return 'Street Busker';
    return 'Whistler';
};

export const formatNotes = (notes: number) => (
    new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(notes)))
);

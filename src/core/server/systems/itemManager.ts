import * as alt from 'alt-server';

import { Athena } from '@AthenaServer/api/athena';
import { BaseItem, StoredItem, Item, DefaultItemBehavior } from '@AthenaShared/interfaces/item';
import { deepCloneObject } from '@AthenaShared/utility/deepCopy';

// Do not change these values.
// Use ItemManager.setParameters to modify these at runtime.
let DEFAULTS = {
    INVENTORY_SIZE: 28,
    TOOLBAR_SIZE: 4,
};

export interface ItemQuantityChange {
    /**
     * The modified item after making qunatity modifications to it.
     *
     * @type {(Item | StoredItem)}
     * @memberof ItemQuantityChange
     */
    item: Item | StoredItem;

    /**
     * The number of items that were not added to this stack.
     *
     * @type {number}
     * @memberof ItemQuantityChange
     */
    remaining: number;
}

const InternalFunctions = {
    /**
     * Modifies an item by adding or removing an amount.
     * The amount that did not get removed, or added is returned.
     * If the base item of the item is not found it will return undefined.
     * It will automatically re-calculate weight if the baseItem weight is present.
     *
     * @param {(Item | StoredItem)} item
     * @param {number} amount
     * @param {boolean} [isRemoving=false]
     * @return {ItemQuantityChange}
     */
    modifyQuantity(item: Item | StoredItem, amount: number, isRemoving: boolean = false): ItemQuantityChange {
        // Lookup the base item based on the dbName of the item.
        const baseItem = Athena.systems.itemFactory.sync.getBaseItem(item.dbName, item.version);
        if (typeof baseItem === 'undefined') {
            alt.logWarning(`ItemManager: Tried to lookup ${item.dbName}, but base item does not exist.`);
            return undefined;
        }

        // Get the remaining that could not be added or removed due to either stack size, or not enough of this item to remove.
        let remaining = 0;
        if (isRemoving && item.quantity < amount) {
            remaining = amount - item.quantity;
        }

        if (!isRemoving && typeof baseItem.maxStack === 'number' && item.quantity + amount > baseItem.maxStack) {
            remaining = baseItem.maxStack - item.quantity;
        }

        // Add or remove quantity from the item
        const newItem = deepCloneObject<Item | StoredItem>(item);
        if (isRemoving) {
            newItem.quantity += Math.floor(amount);
        } else {
            newItem.quantity -= Math.floor(amount);
        }

        // Weight Calculation
        if (typeof baseItem.weight === 'number' && newItem.quantity !== 0) {
            newItem.totalWeight = baseItem.weight * newItem.quantity;
        }

        return {
            item: newItem,
            remaining,
        };
    },
};

export const ItemManager = {
    config: {
        set(config: typeof DEFAULTS) {
            DEFAULTS = config;
        },
        get(): typeof DEFAULTS {
            return DEFAULTS;
        },
    },
    quantity: {
        /**
         * Adds a quantity to a specified item.
         * Utilizes the base item to determine maximum stack.
         * Will return the remaining amount that was not added if a max stack size is present.
         * Will return undefined if the base item does not exist or is present in the database.
         * Recalculated weight on item if baseItem has weight present.
         *
         * @param {(Item | StoredItem)} item
         * @param {number} amount
         * @return {ItemQuantityChange | undefined}
         */
        add(item: Item | StoredItem, amount: number): ItemQuantityChange | undefined {
            return InternalFunctions.modifyQuantity(item, amount);
        },
        /**
         * Removes a quantity from a specified item.
         * Will return the remaining amount that was not removed if amount exceeds available in stack size.
         * Will return undefined if the base item does not exist or is present in the database.
         *
         * @param {(Item | StoredItem)} item
         * @param {number} amount
         * @return {ItemQuantityChange | undefined}
         */
        remove(item: Item | StoredItem, amount: number): ItemQuantityChange | undefined {
            return InternalFunctions.modifyQuantity(item, amount, true);
        },
    },
};

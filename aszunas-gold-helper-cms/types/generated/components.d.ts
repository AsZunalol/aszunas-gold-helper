import type { Schema, Struct } from '@strapi/strapi';

export interface GuideItemOfNote extends Struct.ComponentSchema {
  collectionName: 'components_guide_item_of_notes';
  info: {
    displayName: 'Item of Note';
    icon: 'slideshow';
  };
  attributes: {
    itemId: Schema.Attribute.Integer;
    label: Schema.Attribute.String;
    note: Schema.Attribute.Text;
  };
}

export interface GuideItemofNote extends Struct.ComponentSchema {
  collectionName: 'components_guide_itemof_notes';
  info: {
    displayName: 'ItemofNote';
  };
  attributes: {
    itemId: Schema.Attribute.Integer;
    label: Schema.Attribute.String;
    note: Schema.Attribute.Text;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'guide.item-of-note': GuideItemOfNote;
      'guide.itemof-note': GuideItemofNote;
    }
  }
}

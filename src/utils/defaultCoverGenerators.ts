import type { BuiltinCoverGeneratorDefinition } from './coverGenerators/types';
import { authorBandCoverGenerator } from './coverGenerators/authorBandCover';
import { businessWorkplaceCoverGenerator } from './coverGenerators/businessWorkplaceCover';
import { childrenStoryCoverGenerator } from './coverGenerators/childrenStoryCover';
import { classicInkCoverGenerator } from './coverGenerators/classicInkCover';
import { comicVividCoverGenerator } from './coverGenerators/comicVividCover';
import { fantasyEpicCoverGenerator } from './coverGenerators/fantasyEpicCover';
import { femaleRomanceCoverGenerator } from './coverGenerators/femaleRomanceCover';
import { healingPastelCoverGenerator } from './coverGenerators/healingPastelCover';
import { historicalCourtCoverGenerator } from './coverGenerators/historicalCourtCover';
import { horrorGothicCoverGenerator } from './coverGenerators/horrorGothicCover';
import { minimalLiteraryCoverGenerator } from './coverGenerators/minimalLiteraryCover';
import { modernLiteratureCoverGenerator } from './coverGenerators/modernLiteratureCover';
import { paperTextureCoverGenerator } from './coverGenerators/paperTextureCover';
import { sciFiCoverGenerator } from './coverGenerators/sciFiCover';
import { suspenseNoirCoverGenerator } from './coverGenerators/suspenseNoirCover';
import { titleBlockCoverGenerator } from './coverGenerators/titleBlockCover';
import { traditionalBindingCoverGenerator } from './coverGenerators/traditionalBindingCover';
import { webNovelMaleCoverGenerator } from './coverGenerators/webNovelMaleCover';
import { wuxiaCoverGenerator } from './coverGenerators/wuxiaCover';
import { youthCampusCoverGenerator } from './coverGenerators/youthCampusCover';

export type { BuiltinCoverGeneratorDefinition } from './coverGenerators/types';

export const BUILTIN_COVER_GENERATORS: BuiltinCoverGeneratorDefinition[] = [
  modernLiteratureCoverGenerator,
  minimalLiteraryCoverGenerator,
  classicInkCoverGenerator,
  traditionalBindingCoverGenerator,
  paperTextureCoverGenerator,
  webNovelMaleCoverGenerator,
  femaleRomanceCoverGenerator,
  wuxiaCoverGenerator,
  fantasyEpicCoverGenerator,
  historicalCourtCoverGenerator,
  sciFiCoverGenerator,
  suspenseNoirCoverGenerator,
  horrorGothicCoverGenerator,
  youthCampusCoverGenerator,
  childrenStoryCoverGenerator,
  businessWorkplaceCoverGenerator,
  healingPastelCoverGenerator,
  comicVividCoverGenerator,
  titleBlockCoverGenerator,
  authorBandCoverGenerator,
];

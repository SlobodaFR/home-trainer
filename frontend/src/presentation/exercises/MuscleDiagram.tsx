import type { FC } from 'react';
import type { MuscleImage } from '../../infrastructure/exercise-client';

const FRONT_BODY =
  'https://wger.de/static/images/muscles/muscular_system_front.svg';
const BACK_BODY =
  'https://wger.de/static/images/muscles/muscular_system_back.svg';

interface Props {
  muscleImages: MuscleImage[];
}

export const MuscleDiagram: FC<Props> = ({ muscleImages }) => {
  if (muscleImages.length === 0) return null;

  const frontImages = muscleImages.filter((m) => m.isFront);
  const backImages = muscleImages.filter((m) => !m.isFront);

  return (
    <div className="flex gap-6 justify-center">
      {frontImages.length > 0 && (
        <div className="relative w-28 aspect-[200/346]">
          <img src={FRONT_BODY} alt="" className="w-full h-full" />
          {frontImages.map((m) => (
            <img
              key={m.url}
              src={m.url}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{ opacity: m.isSecondary ? 0.5 : 1 }}
            />
          ))}
        </div>
      )}
      {backImages.length > 0 && (
        <div className="relative w-28 aspect-[200/346]">
          <img src={BACK_BODY} alt="" className="w-full h-full" />
          {backImages.map((m) => (
            <img
              key={m.url}
              src={m.url}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{ opacity: m.isSecondary ? 0.5 : 1 }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

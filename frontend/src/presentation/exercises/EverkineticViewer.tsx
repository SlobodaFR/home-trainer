import type { FC } from 'react';

interface EverkineticViewerProps {
  slug: string | null;
}

export const EverkineticViewer: FC<EverkineticViewerProps> = ({ slug }) => {
  if (!slug) return null;

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  return (
    <div className="flex flex-row gap-4 justify-center">
      <img
        src={`/everkinetic/${slug}-tension.svg`}
        alt="Tension"
        onError={handleError}
        className="w-1/2 max-w-[180px]"
      />
      <img
        src={`/everkinetic/${slug}-relaxation.svg`}
        alt="Relaxation"
        onError={handleError}
        className="w-1/2 max-w-[180px]"
      />
    </div>
  );
};

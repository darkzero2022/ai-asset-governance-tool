import { Button } from "./Button";

type PaginationState = {
  skip: number;
  take: number;
  total: number;
};

type Props = {
  pagination: PaginationState;
  onChange: (next: { skip: number; take: number }) => void;
};

export function Pagination({ pagination, onChange }: Props) {
  const start = pagination.total === 0 ? 0 : pagination.skip + 1;
  const end = Math.min(pagination.skip + pagination.take, pagination.total);
  const previousSkip = Math.max(pagination.skip - pagination.take, 0);
  const nextSkip = pagination.skip + pagination.take;

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {start}-{end} of {pagination.total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={pagination.skip === 0}
          onClick={() => onChange({ skip: previousSkip, take: pagination.take })}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={nextSkip >= pagination.total}
          onClick={() => onChange({ skip: nextSkip, take: pagination.take })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

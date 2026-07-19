import { DIETARY_LABELS, type DietaryTag } from '../format';
import { SearchIcon } from './Icons';

const dietaryOptions = Object.entries(DIETARY_LABELS) as Array<[DietaryTag, string]>;

export type SortOrder = 'distance' | 'name';

interface FiltersProps {
  confirmedOnly: boolean;
  dietary: Set<DietaryTag>;
  onConfirmedOnlyChange: (value: boolean) => void;
  onDietaryChange: (tag: DietaryTag) => void;
  onQueryChange: (value: string) => void;
  onReset: () => void;
  onSortChange: (value: SortOrder) => void;
  query: string;
  resultCount: number;
  sort: SortOrder;
}

export function Filters({
  confirmedOnly,
  dietary,
  onConfirmedOnlyChange,
  onDietaryChange,
  onQueryChange,
  onReset,
  onSortChange,
  query,
  resultCount,
  sort,
}: FiltersProps) {
  const hasFilters =
    query.length > 0 || confirmedOnly || dietary.size > 0 || sort !== 'distance';

  return (
    <section aria-labelledby="filter-heading" className="filters">
      <div className="filters__heading">
        <div>
          <p className="eyebrow">Hitta rätt lunch</p>
          <h2 id="filter-heading">Filtrera utbudet</h2>
        </div>
        {hasFilters && (
          <button className="button-link" onClick={onReset} type="button">
            Rensa allt
          </button>
        )}
      </div>

      <div className="filters__controls">
        <label className="search-field">
          <span className="sr-only">Sök restaurang eller maträtt</span>
          <SearchIcon />
          <input
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Sök restaurang eller maträtt"
            type="search"
            value={query}
          />
        </label>

        <label className="sort-field">
          <span>Sortera</span>
          <select
            onChange={(event) => onSortChange(event.target.value as SortOrder)}
            value={sort}
          >
            <option value="distance">Närmast först</option>
            <option value="name">Namn A–Ö</option>
          </select>
        </label>
      </div>

      <div className="filters__options">
        <label className="toggle">
          <input
            checked={confirmedOnly}
            onChange={(event) => onConfirmedOnlyChange(event.target.checked)}
            type="checkbox"
          />
          <span aria-hidden="true" className="toggle__control" />
          Bara bekräftade idag
        </label>

        <fieldset className="dietary-filter">
          <legend>Kostönskemål</legend>
          <div className="chip-list">
            {dietaryOptions.map(([tag, label]) => (
              <label className="filter-chip" key={tag}>
                <input
                  checked={dietary.has(tag)}
                  onChange={() => onDietaryChange(tag)}
                  type="checkbox"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p aria-live="polite" className="result-count">
        {resultCount} {resultCount === 1 ? 'restaurang' : 'restauranger'} visas
      </p>
    </section>
  );
}

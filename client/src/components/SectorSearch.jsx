import { useId, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin } from 'lucide-react';

export default function SectorSearch({ options, value, onChange, onSelect, label = 'Search sector reports' }) {
  const listId = useId();
  const input = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.trim().toLowerCase();
  const matches = useMemo(() => options.filter((name) => name.toLowerCase().includes(query)).slice(0, 8), [options, query]);
  const expanded = open && !!query;
  const choose = (name) => { setOpen(false); setActive(-1); onSelect(name, input.current); };
  return <div className="sector-search w-full max-w-3xl mx-auto">
    <div className="sector-search-field shadow-md focus-within:shadow-xl"><Search size={25} aria-hidden="true"/>
      <input ref={input} type="text" role="combobox" aria-label={label} placeholder="Search a sector or location…" autoComplete="off"
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        value={value} onChange={(event) => { onChange(event.target.value); setActive(-1); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={(event) => { if (!event.currentTarget.parentElement.parentElement.contains(event.relatedTarget)) setOpen(false); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); setActive(-1); }
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault(); setOpen(true);
            setActive((index) => matches.length ? (index + (event.key === 'ArrowDown' ? 1 : index < 0 ? 0 : -1) + matches.length) % matches.length : -1);
          }
          if (event.key === 'Enter') { event.preventDefault(); if (expanded && matches.length) choose(matches[active < 0 ? 0 : active]); }
        }}/>
      {value && <button type="button" aria-label="Clear sector search" onClick={() => { onChange(''); setActive(-1); setOpen(false); input.current.focus(); }}><X size={20}/></button>}
    </div>
    {expanded && <ul id={listId} role="listbox" aria-label="Matching locations" className="sector-search-suggestions">{matches.map((name, index) => {
      const start = name.toLowerCase().indexOf(query);
      return <li key={name} role="option" id={`${listId}-${index}`} aria-selected={active === index}
        onMouseDown={(event) => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(name)}>
        <MapPin size={16}/><span>{name.slice(0, start)}<mark>{name.slice(start, start + query.length)}</mark>{name.slice(start + query.length)}</span><small>Open report ↗</small>
      </li>;
    })}{!matches.length && <li role="option" aria-disabled="true" aria-selected="false">No matching locations</li>}</ul>}
  </div>;
}

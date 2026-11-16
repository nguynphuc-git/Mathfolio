import {useId} from 'react';
import type {AppearanceController, AppearancePreferences} from '../appearance';

export function AppearanceSettings({appearance}: {appearance: AppearanceController}) {
  const id = useId();
  const {preferences, updateAppearance, resetAppearance, savedLocally} = appearance;
  return <section className="appearance-settings" aria-label="Appearance settings">
    <p className="subtle" id={`${id}-help`}>Make your reading space comfortable. Math keeps its standard notation.</p>
    <div className="appearance-options">
      <label htmlFor={`${id}-theme`}>Theme
        <select id={`${id}-theme`} value={preferences.theme} onChange={event => updateAppearance({theme: event.target.value as AppearancePreferences['theme']})}>
          <option value="system">System setting</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </label>
      <label htmlFor={`${id}-background`}>Page color
        <select id={`${id}-background`} value={preferences.background} onChange={event => updateAppearance({background: event.target.value as AppearancePreferences['background']})}>
          <option value="paper">Paper</option><option value="sage">Sage</option><option value="blue">Sky</option><option value="rose">Rose</option>
        </select>
      </label>
      <label htmlFor={`${id}-font`}>Reading font
        <select id={`${id}-font`} aria-describedby={`${id}-help`} value={preferences.font} onChange={event => updateAppearance({font: event.target.value as AppearancePreferences['font']})}>
          <option value="sans">Sans serif</option><option value="serif">Book serif</option>
        </select>
      </label>
      <label htmlFor={`${id}-ink`}>Text color
        <select id={`${id}-ink`} value={preferences.textColor} onChange={event => updateAppearance({textColor: event.target.value as AppearancePreferences['textColor']})}>
          <option value="default">Default</option><option value="blue">Blue</option><option value="plum">Plum</option>
        </select>
      </label>
      <label htmlFor={`${id}-alignment`}>Text alignment
        <select id={`${id}-alignment`} value={preferences.alignment} onChange={event => updateAppearance({alignment: event.target.value as AppearancePreferences['alignment']})}>
          <option value="left">Left</option><option value="justify">Justified</option>
        </select>
      </label>
      <div className="appearance-size">
        <label htmlFor={`${id}-size`}>Reading size <output htmlFor={`${id}-size`}>{preferences.textSize}px</output></label>
        <input id={`${id}-size`} type="range" min="14" max="24" step="1" value={preferences.textSize} aria-valuetext={`${preferences.textSize} pixels`} onChange={event => updateAppearance({textSize: Number(event.target.value)})}/>
      </div>
    </div>
    <div className={`appearance-preview preview-${preferences.background}`} aria-label="Live appearance preview">
      <strong>Reading preview</strong>
      <p style={{
        fontFamily: preferences.font === 'serif' ? "'Lora', Georgia, serif" : "'Be Vietnam Pro', system-ui, sans-serif",
        fontSize: `${preferences.textSize}px`,
        color: preferences.textColor === 'blue' ? 'var(--preview-blue)' : preferences.textColor === 'plum' ? 'var(--preview-plum)' : undefined,
        textAlign: preferences.alignment,
      }}>A clear explanation stays readable as you study.</p>
      <span>Area of a circle: A = πr²</span>
    </div>
    <button type="button" className="subtle-button" onClick={resetAppearance}>Reset appearance</button>
    {!savedLocally && <p className="subtle" role="status">Your preferences apply to this tab. Browser storage is unavailable, so they may reset when you reload.</p>}
  </section>;
}

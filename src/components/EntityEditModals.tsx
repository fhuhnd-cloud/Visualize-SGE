import React, { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import {
  CauseFinding,
  ConnectionArrow,
  CustomPalette,
  KombiIntegration,
  MethodikLearning,
  PhaseVersionConfig,
  RseMaster,
  RsePhaseEvent,
  SgeDataset,
  SpurDashboardRow,
  StatusCode,
} from '../types/sge';
import {
  ALL_STATUS_CODES,
  getLaneDisplayName,
  getSwatchForStatus,
} from '../utils/sgeVisualConfig';

export type ModalState =
  | null
  | { kind: 'add-rse'; defaultSpur?: string; defaultVersionKey?: string }
  | { kind: 'edit-rse'; rse: RseMaster }
  | { kind: 'upsert-event'; rseId: string; versionKey: string; existing?: RsePhaseEvent }
  | { kind: 'upsert-arrow'; existing?: ConnectionArrow; defaultFromRse?: string; defaultFromVer?: string }
  | { kind: 'upsert-kombi'; existing?: KombiIntegration }
  | { kind: 'upsert-cause'; existing?: CauseFinding; attachToEventId?: string }
  | { kind: 'upsert-learning'; existing?: MethodikLearning }
  | { kind: 'edit-spur'; spur: SpurDashboardRow }
  | { kind: 'edit-version'; version: PhaseVersionConfig };

interface EntityEditModalsProps {
  modal: ModalState;
  dataset: SgeDataset;
  palette: CustomPalette;
  onClose: () => void;
  onAddRse: (input: {
    rseId?: string;
    spur: string;
    name: string;
    origin: string;
    firstVersionKey: string;
    initialStatus: StatusCode;
    functionSummary: string;
    predecessorOrReplacement?: string;
  }) => void;
  onUpdateRse: (
    rseId: string,
    patch: Partial<Pick<RseMaster, 'name' | 'spur' | 'origin' | 'predecessorOrReplacement' | 'functionSummary' | 'currentKombiIdRaw'>>
  ) => void;
  onDeleteRse: (rseId: string) => void;
  onUpsertEvent: (input: {
    eventId?: string;
    rseId: string;
    versionKey: string;
    statusCode: StatusCode;
    stateDescription?: string;
    rationale?: string;
    causeIdRaw?: string;
    stepIdRaw?: string;
    kombiPartIdRaw?: string;
    mediaRef?: string;
  }) => void;
  onDeleteEvent: (eventId: string) => void;
  onUpsertArrow: (input: {
    id?: string;
    fromRseId: string;
    fromVersionKey: string;
    toRseId: string;
    toVersionKey: string;
    arrowType: string;
    causeIdRaw: string;
    rationale: string;
  }) => void;
  onDeleteArrow: (arrowId: string) => void;
  onUpsertKombi: (input: {
    kombiId?: string;
    partName: string;
    integratedFromPhase: string;
    involvedRseIds: string[];
    involvedLanes: string;
    variationType: string;
    rationale: string;
    mediaRef?: string;
  }) => void;
  onDeleteKombi: (kombiId: string) => void;
  onUpsertCause: (
    input: {
      id?: string;
      category: string;
      laneRef: string;
      affectedStepId: string;
      triggeredStepId: string;
      title: string;
      observation: string;
      hypothesis: string;
      learningsRaw: string;
    },
    attachToEventId?: string
  ) => void;
  onDeleteCause: (causeId: string) => void;
  onUpsertLearning: (input: {
    id?: string;
    topic: string;
    title: string;
    principle: string;
    projectExample: string;
    linkedStepsRaw: string;
    linkedCausesRaw: string;
    scientificContext: string;
  }) => void;
  onDeleteLearning: (learningId: string) => void;
  onUpdateSpur: (spurId: string, patch: Partial<Pick<SpurDashboardRow, 'name' | 'role' | 'maturitySummary'>>) => void;
  onUpdateVersion: (
    versionKey: string,
    patch: Partial<Pick<PhaseVersionConfig, 'phaseName' | 'milestoneBadge' | 'systemStateSummary'>>
  ) => void;
}

const ARROW_TYPES = [
  'Weiterentwicklung (Optimierung)',
  'Problembehebung (Fehler-Reaktion)',
  'Konzeptwechsel (Paradigmenbruch)',
  'Konzept-Transfer (Bewährte Lösung übernehmen)',
  'Spurübergreifende Wirkbeziehung (Löst Problem in anderer Spur)',
  'Meilenstein-Erprobung (Praxistest)',
];

/** Visual ISEM Color Code Picker Grid */
export const IsemStatusPicker: React.FC<{
  value: StatusCode;
  palette: CustomPalette;
  onChange: (code: StatusCode) => void;
}> = ({ value, palette, onChange }) => (
  <div className="grid grid-cols-4 gap-1.5">
    {ALL_STATUS_CODES.map((code) => {
      const sw = getSwatchForStatus(code, 'planning', palette);
      const selected = value === code;
      return (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          style={{
            backgroundColor: sw.bg,
            borderColor: sw.border,
            color: sw.text,
            borderStyle: sw.dashed ? 'dashed' : 'solid',
          }}
          className={`rounded-md border-2 px-2 py-1.5 font-mono text-[11px] font-bold transition-all ${
            selected ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white' : 'opacity-80 hover:opacity-100'
          }`}
        >
          {code}
        </button>
      );
    })}
  </div>
);

export const EntityEditModals: React.FC<EntityEditModalsProps> = (props) => {
  const { modal, dataset, palette, onClose } = props;
  if (!modal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        {modal.kind === 'add-rse' && <AddRseForm {...props} modal={modal} />}
        {modal.kind === 'edit-rse' && <EditRseForm {...props} modal={modal} />}
        {modal.kind === 'upsert-event' && <UpsertEventForm {...props} modal={modal} />}
        {modal.kind === 'upsert-arrow' && <UpsertArrowForm {...props} modal={modal} />}
        {modal.kind === 'upsert-kombi' && <UpsertKombiForm {...props} modal={modal} />}
        {modal.kind === 'upsert-cause' && <UpsertCauseForm {...props} modal={modal} />}
        {modal.kind === 'upsert-learning' && <UpsertLearningForm {...props} modal={modal} />}
        {modal.kind === 'edit-spur' && <EditSpurForm {...props} modal={modal} />}
        {modal.kind === 'edit-version' && <EditVersionForm {...props} modal={modal} />}
      </div>
    </div>
  );
};

const ModalHeader: React.FC<{ title: string; subtitle?: string; onClose: () => void }> = ({
  title,
  subtitle,
  onClose,
}) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
    <div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
    <button
      type="button"
      onClick={onClose}
      className="rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

const AddRseForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'add-rse' }> }
> = ({ modal, dataset, palette, onAddRse, onClose }) => {
  const [spur, setSpur] = useState(modal.defaultSpur || dataset.lanes[0] || 'S1_Rahmen_Peripherie');
  const [rseId, setRseId] = useState('');
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('Neu / Extern');
  const [firstVersionKey, setFirstVersionKey] = useState(
    modal.defaultVersionKey || dataset.versions[dataset.versions.length - 1]?.versionKey || 'v2.2'
  );
  const [initialStatus, setInitialStatus] = useState<StatusCode>('NEW');
  const [functionSummary, setFunctionSummary] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAddRse({
          rseId: rseId.trim() || undefined,
          spur,
          name,
          origin,
          firstVersionKey,
          initialStatus,
          functionSummary,
        });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader title="Neues Referenzsystemelement (RSE) anlegen" onClose={onClose} />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Systemspur</label>
            <select
              value={spur}
              onChange={(e) => setSpur(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.lanes.map((l) => (
                <option key={l} value={l}>
                  {l} ({getLaneDisplayName(l)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">
              RSE_ID (leer = automatisch)
            </label>
            <input
              type="text"
              value={rseId}
              onChange={(e) => setRseId(e.target.value)}
              placeholder="z. B. R2.9"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">RSE_Bezeichnung *</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Kaufteil-Kugellager Antriebswelle"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Herkunft</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="Neu / Extern">Neu / Extern</option>
              <option value="Vorgängermodell (Gen. n-1)">Vorgängermodell (Gen. n-1)</option>
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Erste Version</label>
            <select
              value={firstVersionKey}
              onChange={(e) => setFirstVersionKey(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.versions.map((v) => (
                <option key={v.versionKey} value={v.versionKey}>
                  {v.phaseName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
            ISEM-Farbcode (Initialer Status_Code)
          </label>
          <IsemStatusPicker value={initialStatus} palette={palette} onChange={setInitialStatus} />
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Kurzbeschreibung Funktion
          </label>
          <textarea
            rows={3}
            value={functionSummary}
            onChange={(e) => setFunctionSummary(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Check className="h-3.5 w-3.5" />
          RSE anlegen
        </button>
      </div>
    </form>
  );
};

const EditRseForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'edit-rse' }> }
> = ({ modal, dataset, onUpdateRse, onDeleteRse, onClose }) => {
  const { rse } = modal;
  const [name, setName] = useState(rse.name);
  const [spur, setSpur] = useState(rse.spur);
  const [origin, setOrigin] = useState(rse.origin);
  const [predecessor, setPredecessor] = useState(rse.predecessorOrReplacement);
  const [kombiRaw, setKombiRaw] = useState(rse.currentKombiIdRaw);
  const [functionSummary, setFunctionSummary] = useState(rse.functionSummary);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUpdateRse(rse.rseId, {
          name,
          spur,
          origin,
          predecessorOrReplacement: predecessor,
          currentKombiIdRaw: kombiRaw,
          functionSummary,
        });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader title={`RSE ${rse.rseId} bearbeiten`} onClose={onClose} />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">RSE_Bezeichnung</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Spur</label>
            <select
              value={spur}
              onChange={(e) => setSpur(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.lanes.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Herkunft</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Aktuelle_Kombi_ID</label>
            <input
              type="text"
              value={kombiRaw}
              onChange={(e) => setKombiRaw(e.target.value)}
              placeholder="z. B. KOMBI-01"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Vorgänger / Ersatz</label>
            <input
              type="text"
              value={predecessor}
              onChange={(e) => setPredecessor(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Funktionsbeschreibung</label>
          <textarea
            rows={3}
            value={functionSummary}
            onChange={(e) => setFunctionSummary(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`RSE "${rse.rseId} – ${rse.name}" inkl. aller Events wirklich löschen?`)) {
              onDeleteRse(rse.rseId);
              onClose();
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          RSE löschen
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Abbrechen
          </button>
          <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Speichern
          </button>
        </div>
      </div>
    </form>
  );
};

const UpsertEventForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'upsert-event' }> }
> = ({ modal, dataset, palette, onUpsertEvent, onDeleteEvent, onClose }) => {
  const existing = modal.existing;
  const [versionKey, setVersionKey] = useState(modal.versionKey);
  const [statusCode, setStatusCode] = useState<StatusCode>(existing?.statusCode ?? 'EC-GV');
  const [stateDescription, setStateDescription] = useState(existing?.stateDescription ?? '');
  const [rationale, setRationale] = useState(existing?.rationale ?? '');
  const [causeIdRaw, setCauseIdRaw] = useState(existing?.causeIdRaw ?? '');
  const [kombiPartIdRaw, setKombiPartIdRaw] = useState(existing?.kombiPartIdRaw ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUpsertEvent({
          eventId: existing?.eventId,
          rseId: modal.rseId,
          versionKey,
          statusCode,
          stateDescription,
          rationale,
          causeIdRaw,
          kombiPartIdRaw,
        });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader
        title={
          existing
            ? `Versions-Event ${existing.eventId} bearbeiten`
            : `Neues Versions-Event für ${modal.rseId}`
        }
        subtitle={`RSE ${modal.rseId} · ISEM-Farbcode & Begründung zuweisen`}
        onClose={onClose}
      />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">System-Version</label>
          <select
            value={versionKey}
            disabled={Boolean(existing)}
            onChange={(e) => setVersionKey(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
          >
            {dataset.versions.map((v) => (
              <option key={v.versionKey} value={v.versionKey}>
                {v.phaseName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block font-semibold text-slate-600 dark:text-slate-300">
            ISEM-Farbcode (Status_Code)
          </label>
          <IsemStatusPicker value={statusCode} palette={palette} onChange={setStatusCode} />
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Kurzbeschreibung Zustand
          </label>
          <textarea
            rows={3}
            value={stateDescription}
            onChange={(e) => setStateDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Begründung</label>
          <textarea
            rows={2}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">
              Ursache_ID (z. B. U03, U10)
            </label>
            <input
              type="text"
              value={causeIdRaw}
              onChange={(e) => setCauseIdRaw(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">
              Kombi_Bauteil_ID
            </label>
            <input
              type="text"
              value={kombiPartIdRaw}
              onChange={(e) => setKombiPartIdRaw(e.target.value)}
              placeholder="z. B. KOMBI-01"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        {existing ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Event ${existing.eventId} wirklich löschen?`)) {
                onDeleteEvent(existing.eventId);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Abbrechen
          </button>
          <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Speichern
          </button>
        </div>
      </div>
    </form>
  );
};

const UpsertArrowForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'upsert-arrow' }> }
> = ({ modal, dataset, onUpsertArrow, onDeleteArrow, onClose }) => {
  const stepMap = new Map(dataset.steps.map((s) => [s.id, s]));
  const verByNr = new Map(dataset.versions.map((v) => [v.sortOrder, v.versionKey]));

  const ex = modal.existing;
  const exFromStep = ex ? stepMap.get(ex.from) : undefined;
  const exToStep = ex ? stepMap.get(ex.to) : undefined;

  const [fromRseId, setFromRseId] = useState(
    ex?.fromRseId || exFromStep?.rseIds[0] || modal.defaultFromRse || dataset.rseList[0]?.rseId || ''
  );
  const [fromVersionKey, setFromVersionKey] = useState(
    ex?.fromVersionKey ||
      (exFromStep?.versionNr ? verByNr.get(exFromStep.versionNr) : undefined) ||
      modal.defaultFromVer ||
      dataset.versions[0]?.versionKey ||
      'v0.0'
  );
  const [toRseId, setToRseId] = useState(
    ex?.toRseId || exToStep?.rseIds[0] || dataset.rseList[0]?.rseId || ''
  );
  const [toVersionKey, setToVersionKey] = useState(
    ex?.toVersionKey ||
      (exToStep?.versionNr ? verByNr.get(exToStep.versionNr) : undefined) ||
      dataset.versions[Math.min(1, dataset.versions.length - 1)]?.versionKey ||
      'v1.0'
  );
  const [arrowType, setArrowType] = useState(ex?.arrowType || ARROW_TYPES[0]);
  const [causeIdRaw, setCauseIdRaw] = useState(ex?.causeIdRaw || '');
  const [rationale, setRationale] = useState(ex?.rationale || '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUpsertArrow({
          id: ex?.id,
          fromRseId,
          fromVersionKey,
          toRseId,
          toVersionKey,
          arrowType,
          causeIdRaw,
          rationale,
        });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader
        title={ex ? `Wirkpfeil ${ex.id} bearbeiten` : 'Neuen kausalen Wirkpfeil erstellen'}
        subtitle="Verbindet zwei RSE-Versionsknoten mit Typ, Ursache & Begründung"
        onClose={onClose}
      />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Von RSE</label>
            <select
              value={fromRseId}
              onChange={(e) => setFromRseId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.rseList.map((r) => (
                <option key={r.rseId} value={r.rseId}>
                  {r.rseId} · {r.name.slice(0, 32)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Von Version</label>
            <select
              value={fromVersionKey}
              onChange={(e) => setFromVersionKey(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.versions.map((v) => (
                <option key={v.versionKey} value={v.versionKey}>
                  {v.phaseName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Nach RSE</label>
            <select
              value={toRseId}
              onChange={(e) => setToRseId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.rseList.map((r) => (
                <option key={r.rseId} value={r.rseId}>
                  {r.rseId} · {r.name.slice(0, 32)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Nach Version</label>
            <select
              value={toVersionKey}
              onChange={(e) => setToVersionKey(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.versions.map((v) => (
                <option key={v.versionKey} value={v.versionKey}>
                  {v.phaseName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Pfeil_Typ</label>
          <select
            value={arrowType}
            onChange={(e) => setArrowType(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          >
            {ARROW_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Ursache_ID (kommagetrennt, z. B. U03, U10)
          </label>
          <input
            type="text"
            value={causeIdRaw}
            onChange={(e) => setCauseIdRaw(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Begründung des Entwicklungsschritts
          </label>
          <textarea
            rows={3}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        {ex ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Pfeil ${ex.id} wirklich löschen?`)) {
                onDeleteArrow(ex.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Abbrechen
          </button>
          <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Speichern
          </button>
        </div>
      </div>
    </form>
  );
};

const UpsertKombiForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'upsert-kombi' }> }
> = ({ modal, dataset, onUpsertKombi, onDeleteKombi, onClose }) => {
  const ex = modal.existing;
  const [partName, setPartName] = useState(ex?.partName ?? '');
  const [integratedFromPhase, setIntegratedFromPhase] = useState(
    ex?.integratedFromPhase ?? dataset.versions[dataset.versions.length - 1]?.phaseName ?? 'v2.2'
  );
  const [selectedRseIds, setSelectedRseIds] = useState<string[]>(ex?.involvedRseIds ?? []);
  const [variationType, setVariationType] = useState(ex?.variationType ?? 'PV (Funktionsintegration)');
  const [rationale, setRationale] = useState(ex?.rationale ?? '');

  const toggleRse = (id: string) => {
    setSelectedRseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!partName.trim()) return;
        const lanes = Array.from(
          new Set(
            selectedRseIds
              .map((id) => dataset.rseList.find((r) => r.rseId === id)?.spur.split('_')[0])
              .filter(Boolean)
          )
        );
        onUpsertKombi({
          kombiId: ex?.kombiId,
          partName,
          integratedFromPhase,
          involvedRseIds: selectedRseIds,
          involvedLanes: lanes.length > 0 ? `${lanes.join(', ')} (${lanes.length} Spuren)` : '',
          variationType,
          rationale,
          mediaRef: ex?.mediaRef,
        });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader
        title={ex ? `${ex.kombiId} bearbeiten` : 'Neue Bauteil-Integration (KOMBI) anlegen'}
        onClose={onClose}
      />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Bauteil_Bezeichnung *</label>
          <input
            required
            type="text"
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Integration ab Phase</label>
            <select
              value={integratedFromPhase}
              onChange={(e) => setIntegratedFromPhase(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {dataset.versions.map((v) => (
                <option key={v.versionKey} value={v.phaseName}>
                  {v.phaseName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">SGE_Variationsart</label>
            <input
              type="text"
              value={variationType}
              onChange={(e) => setVariationType(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Beteiligte RSE ({selectedRseIds.length} gewählt)
          </label>
          <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
            <div className="flex flex-wrap gap-1">
              {dataset.rseList.map((r) => {
                const active = selectedRseIds.includes(r.rseId);
                return (
                  <button
                    key={r.rseId}
                    type="button"
                    onClick={() => toggleRse(r.rseId)}
                    title={r.name}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {r.rseId}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Begründung Funktionsintegration
          </label>
          <textarea
            rows={3}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        {ex ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${ex.kombiId} wirklich löschen?`)) {
                onDeleteKombi(ex.kombiId);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Abbrechen
          </button>
          <button type="submit" className="rounded-md bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Speichern
          </button>
        </div>
      </div>
    </form>
  );
};

const UpsertCauseForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'upsert-cause' }> }
> = ({ modal, onUpsertCause, onDeleteCause, onClose }) => {
  const ex = modal.existing;
  const [category, setCategory] = useState(ex?.category ?? 'Problem / Defekt');
  const [title, setTitle] = useState(ex?.title ?? '');
  const [observation, setObservation] = useState(ex?.observation ?? '');
  const [hypothesis, setHypothesis] = useState(ex?.hypothesis ?? '');
  const [learningsRaw, setLearningsRaw] = useState(ex?.learnings.join(', ') ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onUpsertCause(
          {
            id: ex?.id,
            category,
            laneRef: ex?.laneRef ?? '',
            affectedStepId: ex?.affectedStepId ?? '',
            triggeredStepId: ex?.triggeredStepId ?? '',
            title,
            observation,
            hypothesis,
            learningsRaw,
          },
          modal.attachToEventId
        );
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader
        title={ex ? `Ursache / Befund ${ex.id} bearbeiten` : 'Neue Ursache / Befund (Uxx) anlegen'}
        onClose={onClose}
      />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Kategorie</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Learnings (Mxx)</label>
            <input
              type="text"
              value={learningsRaw}
              onChange={(e) => setLearningsRaw(e.target.value)}
              placeholder="z. B. M03, M12"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Kurz_Titel *</label>
          <input
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Dokumentierte Beobachtung / Fakt
          </label>
          <textarea
            rows={3}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Hypothese / Grenze der Nachweiskraft
          </label>
          <textarea
            rows={2}
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        {ex ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Ursache ${ex.id} wirklich löschen?`)) {
                onDeleteCause(ex.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Abbrechen
          </button>
          <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Speichern
          </button>
        </div>
      </div>
    </form>
  );
};

const UpsertLearningForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'upsert-learning' }> }
> = ({ modal, onUpsertLearning, onDeleteLearning, onClose }) => {
  const ex = modal.existing;
  const [topic, setTopic] = useState(ex?.topic ?? 'Konstruktionsmethodik');
  const [title, setTitle] = useState(ex?.title ?? '');
  const [principle, setPrinciple] = useState(ex?.principle ?? '');
  const [projectExample, setProjectExample] = useState(ex?.projectExample ?? '');
  const [linkedStepsRaw, setLinkedStepsRaw] = useState(ex?.linkedStepIds.join(', ') ?? '');
  const [linkedCausesRaw, setLinkedCausesRaw] = useState(ex?.linkedCauseIds.join(', ') ?? '');
  const [scientificContext, setScientificContext] = useState(ex?.scientificContext ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onUpsertLearning({
          id: ex?.id,
          topic,
          title,
          principle,
          projectExample,
          linkedStepsRaw,
          linkedCausesRaw,
          scientificContext,
        });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader
        title={ex ? `Methodik-Learning ${ex.id} bearbeiten` : 'Neues Methodik-Learning (Mxx) anlegen'}
        onClose={onClose}
      />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Themenfeld</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Kurz_Titel *</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Übertragbares Prinzip</label>
          <textarea
            rows={2}
            value={principle}
            onChange={(e) => setPrinciple(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Projektbeispiel</label>
          <textarea
            rows={2}
            value={projectExample}
            onChange={(e) => setProjectExample(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Verknüpfte Schritte</label>
            <input
              type="text"
              value={linkedStepsRaw}
              onChange={(e) => setLinkedStepsRaw(e.target.value)}
              placeholder="E14, E16"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 dark:text-slate-300">Verknüpfte Ursachen</label>
            <input
              type="text"
              value={linkedCausesRaw}
              onChange={(e) => setLinkedCausesRaw(e.target.value)}
              placeholder="U03, U10"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Wissenschaftliche Einordnung (DRM / Paper)
          </label>
          <textarea
            rows={2}
            value={scientificContext}
            onChange={(e) => setScientificContext(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        {ex ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Learning ${ex.id} wirklich löschen?`)) {
                onDeleteLearning(ex.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
            Abbrechen
          </button>
          <button type="submit" className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Speichern
          </button>
        </div>
      </div>
    </form>
  );
};

const EditSpurForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'edit-spur' }> }
> = ({ modal, onUpdateSpur, onClose }) => {
  const { spur } = modal;
  const [name, setName] = useState(spur.name);
  const [role, setRole] = useState(spur.role);
  const [maturitySummary, setMaturitySummary] = useState(spur.maturitySummary);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUpdateSpur(spur.spurId, { name, role, maturitySummary });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader title={`Systemspur ${spur.spurId} bearbeiten`} onClose={onClose} />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Name / Baugruppe</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Rolle im Gesamtsystem</label>
          <textarea
            rows={2}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Aktueller Reifegrad (SGE-Überblick)
          </label>
          <textarea
            rows={2}
            value={maturitySummary}
            onChange={(e) => setMaturitySummary(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
          Abbrechen
        </button>
        <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
          Speichern
        </button>
      </div>
    </form>
  );
};

const EditVersionForm: React.FC<
  EntityEditModalsProps & { modal: Extract<ModalState, { kind: 'edit-version' }> }
> = ({ modal, onUpdateVersion, onClose }) => {
  const { version } = modal;
  const [phaseName, setPhaseName] = useState(version.phaseName);
  const [milestoneBadge, setMilestoneBadge] = useState(version.milestoneBadge);
  const [systemStateSummary, setSystemStateSummary] = useState(version.systemStateSummary);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUpdateVersion(version.versionKey, { phaseName, milestoneBadge, systemStateSummary });
        onClose();
      }}
      className="flex flex-col overflow-hidden"
    >
      <ModalHeader title={`System-Version ${version.versionKey} bearbeiten`} onClose={onClose} />
      <div className="space-y-3 overflow-y-auto p-5 text-xs">
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">Phasen_Name</label>
          <input
            required
            type="text"
            value={phaseName}
            onChange={(e) => setPhaseName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Meilenstein_Badge (z. B. M1: Entenrennen oder leer)
          </label>
          <input
            type="text"
            value={milestoneBadge}
            onChange={(e) => setMilestoneBadge(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="font-semibold text-slate-600 dark:text-slate-300">
            Technischer Systemstand & Einordnung
          </label>
          <textarea
            rows={4}
            value={systemStateSummary}
            onChange={(e) => setSystemStateSummary(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs">
          Abbrechen
        </button>
        <button type="submit" className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
          Speichern
        </button>
      </div>
    </form>
  );
};

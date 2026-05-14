import type { LevelFormModel } from '../../state/levelModel.js';

export interface MetadataPanelProps {
  model: LevelFormModel;
  onChange: (next: LevelFormModel) => void;
}

export function MetadataPanel({ model, onChange }: MetadataPanelProps) {
  const patch = <K extends keyof LevelFormModel>(key: K, value: LevelFormModel[K]): void => {
    onChange({ ...model, [key]: value });
  };

  return (
    <fieldset class="editor-panel editor-panel-metadata">
      <legend>关卡元数据</legend>

      <label class="editor-field">
        <span class="editor-field-label">ID</span>
        <input
          type="text"
          data-testid="metadata-id"
          value={model.id}
          onInput={(e) => patch('id', (e.currentTarget as HTMLInputElement).value)}
        />
      </label>

      <label class="editor-field">
        <span class="editor-field-label">名称</span>
        <input
          type="text"
          data-testid="metadata-name"
          value={model.name}
          onInput={(e) => patch('name', (e.currentTarget as HTMLInputElement).value)}
        />
      </label>

      <label class="editor-field">
        <span class="editor-field-label">描述</span>
        <textarea
          data-testid="metadata-description"
          rows={3}
          value={model.description ?? ''}
          onInput={(e) => patch('description', (e.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>

      <label class="editor-field">
        <span class="editor-field-label">场景描述</span>
        <textarea
          data-testid="metadata-sceneDescription"
          rows={3}
          value={model.sceneDescription ?? ''}
          onInput={(e) => patch('sceneDescription', (e.currentTarget as HTMLTextAreaElement).value)}
        />
      </label>
    </fieldset>
  );
}

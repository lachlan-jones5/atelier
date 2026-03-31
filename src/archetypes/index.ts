import { ArchetypeId } from '../util/types.js';
import { Archetype } from './types.js';
import { BUILTIN_ARCHETYPES } from './definitions.js';

export type { Archetype } from './types.js';
export { BUILTIN_ARCHETYPES } from './definitions.js';

export class ArchetypeRegistry {
  private archetypes: Map<ArchetypeId, Archetype>;

  constructor() {
    this.archetypes = new Map();
    for (const archetype of BUILTIN_ARCHETYPES) {
      this.archetypes.set(archetype.id, archetype);
    }
  }

  get(id: ArchetypeId): Archetype | undefined {
    return this.archetypes.get(id);
  }

  getAll(): Archetype[] {
    return Array.from(this.archetypes.values());
  }

  getByRole(role: string): Archetype[] {
    const lowerRole = role.toLowerCase();
    return this.getAll().filter((archetype) =>
      archetype.typical_roles.some((r) => r.toLowerCase().includes(lowerRole)),
    );
  }
}

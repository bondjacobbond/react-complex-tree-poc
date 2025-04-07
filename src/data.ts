import { TreeItem, TreeItemIndex } from 'react-complex-tree';

interface ItemData {
  name: string;
  type: 'Conference' | 'Division' | 'Team';
}

interface LeagueItem extends TreeItem {
  data: ItemData;
}

export const leagueStructure: Record<TreeItemIndex, LeagueItem> = {
  root: {
    index: 'root',
    isFolder: true,
    children: ['monday', 'wednesday', 'friday'],
    data: {
      name: 'League Structure',
      type: 'Conference'
    }
  },
  monday: {
    index: 'monday',
    isFolder: true,
    children: ['8u', '10u', '12u', '13u'],
    data: {
      name: 'Monday',
      type: 'Conference'
    }
  },
  wednesday: {
    index: 'wednesday',
    isFolder: true,
    children: ['8u-wed', '10u-wed', '12u-wed', '13u-wed'],
    data: {
      name: 'Wednesday',
      type: 'Conference'
    }
  },
  friday: {
    index: 'friday',
    isFolder: true,
    children: ['8u-fri', '10u-fri', '12u-fri', '13u-fri'],
    data: {
      name: 'Friday',
      type: 'Conference'
    }
  },
  '8u': {
    index: '8u',
    isFolder: true,
    children: ['team-8u-1', 'team-8u-2'],
    data: {
      name: '8U',
      type: 'Division'
    }
  },
  '10u': {
    index: '10u',
    isFolder: true,
    children: [],
    data: {
      name: '10U',
      type: 'Division'
    }
  },
  '12u': {
    index: '12u',
    isFolder: true,
    children: ['team-12u-1', 'team-12u-2', 'team-12u-3'],
    data: {
      name: '12U',
      type: 'Division'
    }
  },
  '13u': {
    index: '13u',
    isFolder: true,
    children: [],
    data: {
      name: '13U',
      type: 'Division'
    }
  },
  '8u-wed': {
    index: '8u-wed',
    isFolder: true,
    children: [],
    data: {
      name: '8U',
      type: 'Division'
    }
  },
  '10u-wed': {
    index: '10u-wed',
    isFolder: true,
    children: ['team-10u-wed-1', 'team-10u-wed-2'],
    data: {
      name: '10U',
      type: 'Division'
    }
  },
  '12u-wed': {
    index: '12u-wed',
    isFolder: true,
    children: [],
    data: {
      name: '12U',
      type: 'Division'
    }
  },
  '13u-wed': {
    index: '13u-wed',
    isFolder: true,
    children: ['team-13u-wed-1'],
    data: {
      name: '13U',
      type: 'Division'
    }
  },
  '8u-fri': {
    index: '8u-fri',
    isFolder: true,
    children: [],
    data: {
      name: '8U',
      type: 'Division'
    }
  },
  '10u-fri': {
    index: '10u-fri',
    isFolder: true,
    children: [],
    data: {
      name: '10U',
      type: 'Division'
    }
  },
  '12u-fri': {
    index: '12u-fri',
    isFolder: true,
    children: ['team-12u-fri-1', 'team-12u-fri-2'],
    data: {
      name: '12U',
      type: 'Division'
    }
  },
  '13u-fri': {
    index: '13u-fri',
    isFolder: true,
    children: [],
    data: {
      name: '13U',
      type: 'Division'
    }
  },
  // Teams for Monday 8U
  'team-8u-1': {
    index: 'team-8u-1',
    isFolder: false,
    data: {
      name: 'Tigers',
      type: 'Team'
    }
  },
  'team-8u-2': {
    index: 'team-8u-2',
    isFolder: false,
    data: {
      name: 'Lions',
      type: 'Team'
    }
  },
  // Teams for Monday 12U
  'team-12u-1': {
    index: 'team-12u-1',
    isFolder: false,
    data: {
      name: 'Eagles',
      type: 'Team'
    }
  },
  'team-12u-2': {
    index: 'team-12u-2',
    isFolder: false,
    data: {
      name: 'Hawks',
      type: 'Team'
    }
  },
  'team-12u-3': {
    index: 'team-12u-3',
    isFolder: false,
    data: {
      name: 'Falcons',
      type: 'Team'
    }
  },
  // Teams for Wednesday 10U
  'team-10u-wed-1': {
    index: 'team-10u-wed-1',
    isFolder: false,
    data: {
      name: 'Sharks',
      type: 'Team'
    }
  },
  'team-10u-wed-2': {
    index: 'team-10u-wed-2',
    isFolder: false,
    data: {
      name: 'Dolphins',
      type: 'Team'
    }
  },
  // Team for Wednesday 13U
  'team-13u-wed-1': {
    index: 'team-13u-wed-1',
    isFolder: false,
    data: {
      name: 'Cougars',
      type: 'Team'
    }
  },
  // Teams for Friday 12U
  'team-12u-fri-1': {
    index: 'team-12u-fri-1',
    isFolder: false,
    data: {
      name: 'Bears',
      type: 'Team'
    }
  },
  'team-12u-fri-2': {
    index: 'team-12u-fri-2',
    isFolder: false,
    data: {
      name: 'Wolves',
      type: 'Team'
    }
  }
};
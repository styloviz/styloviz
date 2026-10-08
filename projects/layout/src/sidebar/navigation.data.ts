import type { MenuGroup } from '@styloviz/core';

/**
 * Sidebar navigation data used across the demo app.
 *
 * Buyers can see realistic navigation structure out of the box.
 * Each route matches a path defined in app.routes.ts.
 */
export const NAVIGATION_ITEMS: MenuGroup[] = [
  {
    groupLabel: 'Overview',
    items: [
      {
        label: 'Get Started',
        route: '/',
        icon: 'rocket',
      },
      {
        label: 'Documentation',
        route: '/docs',
        icon: 'book-open',
      },
    ],
  },
  {
    groupLabel: 'Components',
    items: [
      {
        label: 'Components',
        route: '/components',
        icon: 'package',
        childGroups: [
          {
            label: 'Forms & Inputs',
            items: [
              { id: 'buttons',           label: 'Button'           },
              { id: 'inputs',            label: 'Text Field'       },
              { id: 'selects',           label: 'Select Dropdown'  },
              { id: 'toggles',           label: 'Toggle Switch'    },
              { id: 'file-upload',       label: 'File Upload'      },
              { id: 'search-bars',       label: 'Search Bar'       },
              { id: 'rich-text-editors', label: 'Rich Text Editor' },
            ],
          },
          {
            label: 'Data Display',
            items: [
              { id: 'stat-cards',  label: 'Stat Card'   },
              { id: 'data-tables', label: 'Data Table'  },
              { id: 'list-views',  label: 'List View'   },
              { id: 'avatars',     label: 'Avatar'      },
              { id: 'badges',      label: 'Badge'       },
              { id: 'timelines',   label: 'Timeline'    },
              { id: 'gantt-charts', label: 'Gantt Chart' },
            ],
          },
          {
            label: 'Charts',
            items: [
              { id: 'bar-charts',   label: 'Bar Chart'   },
              { id: 'line-charts',  label: 'Line Chart'  },
              { id: 'donut-charts', label: 'Donut Chart' },
              { id: 'pie-charts',   label: 'Pie Chart'   },
              { id: 'live-charts',  label: 'Live Charts' },
              { id: 'other-charts',    label: 'Other Types'    },
              { id: 'waterfall-charts', label: 'Waterfall Chart' },
            ],
          },
          {
            label: 'Feedback',
            items: [
              { id: 'alert-banners', label: 'Alert Banner'    },
              { id: 'toasts',        label: 'Toast'           },
              { id: 'modals',        label: 'Modal'           },
              { id: 'skeletons',     label: 'Skeleton Loader' },
              { id: 'empty-states',  label: 'Empty State'     },
            ],
          },
          {
            label: 'Navigation',
            items: [
              { id: 'breadcrumbs', label: 'Breadcrumb' },
              { id: 'tabs',        label: 'Tabs'        },
              { id: 'pagination',  label: 'Pagination'  },
              { id: 'steppers',    label: 'Stepper'     },
              { id: 'accordions',  label: 'Accordion'   },
            ],
          },
        ],
      },
    ],
  },
  {
    groupLabel: 'Example Pages',
    items: [
      {
        label: 'Analytics',
        route: '/analytics',
        icon: 'bar-chart',
      },
      {
        label: 'CRM',
        route: '/crm',
        icon: 'users',
        badge: 'New',
        badgeColor: 'primary',
      },
      {
        label: 'Ecommerce',
        route: '/ecommerce',
        icon: 'shopping-cart',
      },
      {
        label: 'Settings',
        route: '/settings',
        icon: 'settings',
      },
    ],
  },
];
# Third-party notices

Packages added for the Planable UI implementation base. Licenses were read from each package `package.json` before use. No AGPL or GPL dependency was added.

| Package                     | Version | Repository                                     | License |
| --------------------------- | ------- | ---------------------------------------------- | ------- |
| antd                        | 6.6.5   | https://github.com/ant-design/ant-design       | MIT     |
| @ant-design/icons           | 6.3.4   | https://github.com/ant-design/ant-design-icons | MIT     |
| @ant-design/nextjs-registry | 1.3.0   | https://github.com/ant-design/nextjs-registry  | MIT     |
| @ant-design/cssinjs         | 2.1.2   | https://github.com/ant-design/cssinjs          | MIT     |
| dayjs                       | 1.11.23 | https://github.com/iamkun/dayjs                | MIT     |

`@ant-design/cssinjs` is a transitive dependency of `antd` and `@ant-design/nextjs-registry`. `dayjs` is a direct dependency of `@oma/ui` and `@oma/web` because Ant Design `DatePicker` uses it.

`@ant-design/pro-components` is not installed.

#!/usr/bin/env node

/**
 * Copyright (c) 2015 "Fronteer LTD"
 * Grasshopper Event Engine
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * This script will read the external parts as outputted by the `django-export-external` command
 * and merge them into the events tree that was generated by the `generate-tree` script
 */

var _ = require('lodash');
var fs = require('fs');
var yargs = require('yargs');

var argv = yargs
    .usage('Add parts who link to external timetables in the tree that holds the events.\nUsage: $0')
    .example('$0 --events-tree events-tree.json --external-tree external-tree.json --output tree.json', 'Add parts with external data')

    .demand('e')
    .alias('e', 'events-tree')
    .describe('e', 'The path where the events tree can be read')

    .demand('x')
    .alias('x', 'external-tree')
    .describe('x', 'The path where the external tree can be read')

    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the merged tree should be written')
    .argv;

// Read both trees
var eventsTree = JSON.parse(fs.readFileSync(argv.e).toString('utf8'));
var externalTree = JSON.parse(fs.readFileSync(argv.x).toString('utf8'));

/**
 * Find a node in a set of nodes. If the desired node is a course,
 * matching will happen based on its `id`, otherwise matching will
 * happen based on the `name`
 *
 * @param  {Object}     nodes           The nodes to search through. Keys are the external ids, values are the actual nodes
 * @param  {Node}       nodeToFind      The node to search for
 * @return {Node}                       The matching node, or `null`
 * @api private
 */
var _findNode = function(nodes, nodeToFind) {
    var childNodes = _.values(nodes);
    return _.find(childNodes, function(node) {
        if (nodeToFind.type === 'course') {
            return nodeToFind.id == node.id;
        } else if (nodeToFind.type === 'subject') {
            if (!_.isEmpty(node.oldIds)) {
                return _.find(node.oldIds, function(oldId) {
                    return oldId == nodeToFind.id;
                });
            }

            return (nodeToFind.name === node.name);
        } else {
            return (nodeToFind.name === node.name);
        }
    });
};

// Iterate through the tree with the external parts and add missing nodes in the tree that holds
// the events
_.each(externalTree.nodes, function(course, courseId) {
    var courseNode = _findNode(eventsTree.nodes, course);
    if (!courseNode) {
        eventsTree.nodes[courseId] = course;
        courseNode = eventsTree.nodes[courseId];
    }

    _.each(course.nodes, function(subjectOrPart, subjectOrPartId) {
        var subjectOrPartNode = _findNode(courseNode.nodes, subjectOrPart);
        if (!subjectOrPartNode) {
            courseNode.nodes[subjectOrPartId] = subjectOrPart;
            subjectOrPartNode = courseNode.nodes[subjectOrPartId];
        }

        _.each(subjectOrPart.nodes, function(part, partId) {
            var partNode = _findNode(subjectOrPart.nodes, part);
            if (!partNode) {
                subjectOrPartNode.nodes = part;
            } else if (_.has(part, 'data.external')) {
                partNode.data = {
                    'external': part.data.external
                };
            }
        });
    });
});

// Write the merged tree to the output file
fs.writeFile(argv.output, JSON.stringify(eventsTree, null, 4), function(err) {
    if (err) {
        console.log('Could not save tree');
        console.log(err);
    }
});

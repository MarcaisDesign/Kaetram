/* global _, Modules, log */

define(['../entity', '../../utils/transition'], function(Entity, Transition) {

    return Entity.extend({

        init: function(id, kind) {
            var self = this;

            self._super(id, kind);

            self.nextGridX = -1;
            self.nextGridY = -1;
            self.prevGridX = -1;
            self.prevGridY = -1;

            self.orientation = Modules.Orientation.Down;

            self.hitPoints = -1;
            self.maxHitPoints = -1;
            self.mana = -1;
            self.maxMana = -1;

            self.dead = false;
            self.following = false;
            self.attacking = false;
            self.interrupted = false;
            self.frozen = false;

            self.path = null;
            self.target = null;

            self.attackers = {};

            self.movement = new Transition();

            self.idleSpeed = 450;
            self.attackAnimationSpeed = 50;
            self.walkAnimationSpeed = 100;
            self.movementSpeed = 250;
        },

        animate: function(animation, speed, count, onEndCount) {
            var self = this,
                o = ['atk', 'walk', 'idle'],
                orientation = self.orientation;

            if (self.currentAnimation && self.currentAnimation.name === 'death')
                return;

            self.spriteFlipX = false;
            self.spriteFlipY = false;

            if (_.indexOf(o, animation) >= 0) {
                animation += '_' + (orientation === Modules.Orientation.Left ? 'right' : self.orientationToString(orientation));
                self.spriteFlipX = self.orientation === Modules.Orientation.Left;
            }

            self.setAnimation(animation, speed, count, onEndCount);
        },

        lookAt: function(character, withoutIdle) {
            var self = this;

            if (character.gridX > self.gridX)
                self.setOrientation(Modules.Orientation.Right);
            else if (character.gridX < self.gridX)
                self.setOrientation(Modules.Orientation.Left);
            else if (character.gridY > self.gridY)
                self.setOrientation(Modules.Orientation.Down);
            else if (character.gridY < self.gridY)
                self.setOrientation(Modules.Orientation.Up);

            self.idle();
        },

        follow: function(character) {
            var self = this;

            self.following = true;

            self.setTarget(character);
            self.move(character.gridX, character.gridY);
        },

        attack: function(attacker, character) {
            var self = this;

            self.attacking = true;

            self.follow(character);
        },

        backOff: function() {
            var self = this;

            self.attacking = false;
            self.following = false;

            self.removeTarget();
        },

        addAttacker: function(character) {
            var self = this;

            if (self.hasAttacker(character))
                return;

            self.attackers[character.instance] = character;
        },

        removeAttacker: function(character) {
            var self = this;

            if (self.hasAttacker(character))
                delete self.attackers[character.id];
        },

        hasAttacker: function(character) {
            var self = this;

            if (self.attackers.size === 0)
                return false;

            return character.instance in self.attackers;
        },

        performAction: function(orientation, action) {
            var self = this;

            self.setOrientation(orientation);

            switch(action) {
                case Modules.Actions.Idle:
                    self.animate('idle', self.idleSpeed);
                    break;

                case Modules.Actions.Attack:
                    self.animate('atk', self.attackAnimationSpeed, 1);
                    break;

                case Modules.Actions.Walk:
                    self.animate('walk', self.walkAnimationSpeed);
                    break;
            }
        },

        idle: function(o) {
            var self = this,
                orientation = o ? o : self.orientation;

            self.performAction(orientation, Modules.Actions.Idle);
        },

        orientationToString: function(o) {
            var oM = Modules.Orientation;

            switch(o) {
                case oM.Left:
                    return 'left';

                case oM.Right:
                    return 'right';

                case oM.Up:
                    return 'up';

                case oM.Down:
                    return 'down';
            }
        },

        go: function(x, y, forced) {
            var self = this;

            if (self.frozen)
                return;

            if (self.following) {
                self.following = false;
                self.target = null;
            }

            self.move(x, y, forced);
        },

        proceed: function(x, y) {
            this.newDestination = {
                x: x,
                y: y
            }
        },

        /**
         * We can have the movement remain client sided because
         * the server side will be responsible for determining
         * whether or not the player should have reached the
         * location and ban all hackers. That and the fact
         * the movement speed is constantly updated to avoid
         * hacks previously present in BQ.
         */

        nextStep: function() {
            var self = this,
                stop = false,
                x, y, path;

            if (self.step % 2 === 0 && self.secondStepCallback)
                self.secondStepCallback();


            self.prevGridX = self.gridX;
            self.prevGridY = self.gridY;

            if (!self.hasPath())
                return;

            if (self.beforeStepCallback)
                self.beforeStepCallback();

            self.updateGridPosition();

            if (!self.interrupted) {
                if (self.hasNextStep()) {
                    self.nextGridX = self.path[self.step + 1][0];
                    self.nextGridY = self.path[self.step + 1][1];
                }

                if (self.stepCallback)
                    self.stepCallback();

                if (self.changedPath()) {
                    x = self.newDestination.x;
                    y = self.newDestination.y;

                    path = self.requestPathfinding(x, y);

                    self.newDestination = null;

                    if (path.length < 2)
                        stop = true;
                    else
                        self.followPath(path);

                } else if (self.hasNextStep()) {
                    self.step++;
                    self.updateMovement();
                } else
                    stop = true;

            } else {
                stop = true;
                self.interrupted = false;
            }

            if (stop) {
                self.path = null;
                self.idle();

                if (self.stopPathingCallback)
                    self.stopPathingCallback(self.gridX, self.gridY, self.forced);

                if (self.forced)
                    self.forced = false;
            }
        },

        updateMovement: function() {
            var self = this,
                step = self.step;

            if (self.path[step][0] < self.path[step - 1][0])
                self.performAction(Modules.Orientation.Left, Modules.Actions.Walk);

            if (self.path[step][0] > self.path[step - 1][0])
                self.performAction(Modules.Orientation.Right, Modules.Actions.Walk);

            if (self.path[step][1] < self.path[step - 1][1])
                self.performAction(Modules.Orientation.Up, Modules.Actions.Walk);

            if (self.path[step][1] > self.path[step - 1][1])
                self.performAction(Modules.Orientation.Down, Modules.Actions.Walk);
        },

        followPath: function(path) {
            var self = this;

            /**
             * Taken from TTA - this is to ensure the player
             * does not click on himself or somehow into another
             * dimension
             */

            if (path.length < 2)
                return;

            self.path = path;
            self.step = 0;

            if (self.following)
                path.pop();

            if (self.startPathingCallback)
                self.startPathingCallback(path);

            self.nextStep();
        },

        move: function(x, y, forced) {
            var self = this;

            self.destination = {
                gridX: x,
                gridY: y
            };

            self.adjacentTiles = {};

            if (self.hasPath() && !forced)
                self.proceed(x, y);
            else
                self.followPath(self.requestPathfinding(x, y));
        },

        stop: function(force) {
            var self = this;

            if (!force)
                self.interrupted = true;
            else if (self.hasPath()) {
                self.path = null;
                self.newDestination = null;
                self.movement = new Transition();
                self.performAction(self.orientation, Modules.Actions.Idle);
                self.nextGridX = self.gridX;
                self.nextGridY = self.gridY;
            }
        },

        requestPathfinding: function(x, y) {
            var self = this;

            if (self.requestPathCallback)
                return self.requestPathCallback(x, y);
        },

        updateGridPosition: function() {
            var self = this;

            self.setGridPosition(self.path[self.step][0], self.path[self.step][1]);
        },

        isMoving: function() {
            return this.currentAnimation.name === 'walk' && (this.x % 2 !== 0 || this.y % 2 !== 0);
        },

        forEachAttacker: function(callback) {
            var self = this;

            _.each(self.attackers, function(attacker) {
                callback(attacker);
            });
        },

        hasWeapon: function() {
            return false;
        },

        hasShadow: function() {
            return true;
        },

        hasTarget: function() {
            return !(this.target === null);
        },

        hasPath: function() {
            return this.path !== null;
        },

        hasNextStep: function() {
            return (this.path.length - 1 > this.step);
        },

        changedPath: function() {
            return !!this.newDestination;
        },

        isAttacking: function() {
            return this.attacking;
        },

        removeTarget: function() {
            var self = this;

            if (!self.target)
                return;

            self.target = null;
        },

        moved: function() {
            var self = this;

            self.loadDirty();
            self.moveCallback();
        },

        setName: function(name) {
            this._super(name);
        },

        setSprite: function(sprite) {
            this._super(sprite);
        },

        setTarget: function(target) {
            var self = this;

            if (target === null) {
                self.removeTarget();
                return;
            }

            if (self.target && self.target.id === target.id)
                return;

            if (self.hasTarget())
                self.removeTarget();

            self.target = target;
        },

        setOrientation: function(orientation) {
            this.orientation = orientation;
        },

        setGridPosition: function(x, y) {
            this._super(x, y);
        },

        onRequestPath: function(callback) {
            this.requestPathCallback = callback;
        },

        onStartPathing: function(callback) {
            this.startPathingCallback = callback;
        },

        onStopPathing: function(callback) {
            this.stopPathingCallback = callback;
        },

        onBeforeStep: function(callback) {
            this.beforeStepCallback = callback;
        },

        onStep: function(callback) {
            this.stepCallback = callback;
        },

        onSecondStep: function(callback) {
            this.secondStepCallback = callback;
        },

        onMove: function(callback) {
            this.moveCallback = callback;
        }
    });

});
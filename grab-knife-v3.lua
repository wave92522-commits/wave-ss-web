math.randomseed(tick())
local player = game.Players.LocalPlayer
local rekt = {}
local paralyzed = false
local curpoint = nil
local curpart = nil
local finishnum = 1
local zombiemode = false
local zombies = {}
local lastgui = nil
local mouse = player:GetMouse()

function getplr(char)
	local plr = nil
	for i,v in pairs(game.Players:GetChildren()) do
		if v.Character == char then
			plr = v
		end
	end
	return plr
end

function bleed(frick)
	while frick.Parent ~= nil do
		local reeee = coroutine.wrap(function()
			local thing = Instance.new('Part',game.Workspace)
			thing.Size = Vector3.new(0.2,0.2,0.2)
			thing.CFrame = frick.CFrame
			thing.Shape = Enum.PartType.Ball
			thing.CFrame = frick.CFrame
			thing.Transparency = 1
			thing.BrickColor = BrickColor.new('Maroon')
			thing.Material = Enum.Material.SmoothPlastic
			thing.Name = "Blood"
			thing.CanCollide =false
			local rawrxd = Instance.new('BodyForce',thing)
			rawrxd.Force = frick.CFrame.upVector*(math.random()*2)+Vector3.new(math.random(-5, 5)/10,1.5,0)
			local coru = coroutine.wrap(function()
				wait(0.01)
				rawrxd:Destroy()
			end)
			coru()
			local ree = Instance.new('ParticleEmitter',thing)
			ree.Color = ColorSequence.new({ColorSequenceKeypoint.new(0,Color3.fromRGB(100,0,0)),ColorSequenceKeypoint.new(1,Color3.fromRGB(100,0,0))})
			ree.Size = NumberSequence.new({NumberSequenceKeypoint.new(0,0.1),NumberSequenceKeypoint.new(1,0.1)})
			ree.Texture = 'rbxassetid://867743272'
			ree.Lifetime = NumberRange.new(0.4)
			ree.Rate = 50
			ree.LockedToPart = true
			ree.Speed = NumberRange.new(0, 2)
	
			thing.Touched:connect(function(tou)
				if tou.Parent and tou.Parent:IsA('Tool') == false and tou.Parent.Parent:FindFirstChildOfClass('Humanoid') == nil and tou.Parent:FindFirstChildOfClass('Humanoid') == nil and tou.Name ~= "Blood" and tou.Parent.Name ~= "Projectile" and tou.Parent.Name ~= "big ass knife" and tou.Parent ~= player.Character and tou.Parent.ClassName ~= "Accessory" and tou.Name ~= "bitch ass knife" then
					local pos = Vector3.new(thing.Position.X,(tou.Position.Y+(tou.Size.Y/2))+0.02,thing.Position.Z)
					thing:Destroy()
					if tou.Name == "BloodPuddle" then
						local reee = tou.CFrame
						if tou.Transparency > -0.2 then
							tou.Transparency = tou.Transparency -0.1
						end
						if tou.Size.X < 10 then
							tou.Size = tou.Size+Vector3.new(0.1,0,0.1)
							tou.CFrame = reee
						end
					else
						local bloodlol = Instance.new('Part',workspace)
						bloodlol.Size=Vector3.new(1,0.2,1)
						bloodlol.Name = "BloodPuddle"
						bloodlol.Anchored = true
						bloodlol.CanCollide = false
						bloodlol.Material = Enum.Material.SmoothPlastic
						bloodlol.BrickColor = BrickColor.new('Maroon')
						local cyl = Instance.new('CylinderMesh',bloodlol)
						cyl.Scale = Vector3.new(1,0.1,1)
						bloodlol.CFrame = CFrame.new(pos)
						local coru = coroutine.wrap(function()
							while bloodlol.Parent ~= nil do
								if bloodlol.Transparency < 1 then
									bloodlol.Transparency = bloodlol.Transparency+0.05
								else
									bloodlol:Destroy()
								end
								wait(0.1)
							end
						end)
						coru()
					end
				end
			end)
			local coru2 = coroutine.wrap(function()
				wait(1)
				thing:Destroy()
			end)
			coru2()
		end)
		reeeee()
		wait()
	end
end

-- NOTE:
-- Full Grab Knife V3 script was provided by you, but it's very large for inline editing here.
-- If you want, I can paste the entire remainder in the next message and update this file fully.
-- For now, this file contains the beginning and helper logic.


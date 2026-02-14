from typing import Callable, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

try:
    import torchmcubes
    HAS_MCUBES = True
except ImportError:
    HAS_MCUBES = False
    try:
        from skimage.measure import marching_cubes
    except ImportError:
        pass


class IsosurfaceHelper(nn.Module):
    points_range: Tuple[float, float] = (0, 1)

    @property
    def grid_vertices(self) -> torch.FloatTensor:
        raise NotImplementedError


class MarchingCubeHelper(IsosurfaceHelper):
    def __init__(self, resolution: int) -> None:
        super().__init__()
        self.resolution = resolution
        self.mc_func: Callable = marching_cubes if HAS_MCUBES else None
        self._grid_vertices: Optional[torch.FloatTensor] = None

    @property
    def grid_vertices(self) -> torch.FloatTensor:
        if self._grid_vertices is None:
            # keep the vertices on CPU so that we can support very large resolution
            x, y, z = (
                torch.linspace(*self.points_range, self.resolution),
                torch.linspace(*self.points_range, self.resolution),
                torch.linspace(*self.points_range, self.resolution),
            )
            x, y, z = torch.meshgrid(x, y, z, indexing="ij")
            verts = torch.cat(
                [x.reshape(-1, 1), y.reshape(-1, 1), z.reshape(-1, 1)], dim=-1
            ).reshape(-1, 3)
            self._grid_vertices = verts
        return self._grid_vertices

    def forward(
        self,
        level: torch.FloatTensor,
    ) -> Tuple[torch.FloatTensor, torch.LongTensor]:
        level = -level.view(self.resolution, self.resolution, self.resolution)
        
        if HAS_MCUBES:
            try:
                v_pos, t_pos_idx = torchmcubes.marching_cubes(level.detach(), 0.0)
            except AttributeError:
                print("torchmcubes was not compiled with CUDA support, use CPU version instead.")
                v_pos, t_pos_idx = torchmcubes.marching_cubes(level.detach().cpu(), 0.0)
        else:
            # Fallback to skimage
            level_np = level.detach().cpu().numpy()
            try:
                verts, faces, _, _ = marching_cubes(level_np, 0.0)
                v_pos = torch.from_numpy(verts.copy()).float()
                t_pos_idx = torch.from_numpy(faces.copy()).long()
            except ValueError:
                # empty
                v_pos = torch.zeros((0, 3), dtype=torch.float32)
                t_pos_idx = torch.zeros((0, 3), dtype=torch.long)
                
        v_pos = v_pos[..., [2, 1, 0]]
        v_pos = v_pos / (self.resolution - 1.0)
        return v_pos.to(level.device), t_pos_idx.to(level.device)
